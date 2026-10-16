import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { Vote, type VoteTrackable } from "../../../domain/model/aggregates/vote.aggregate.js";
import type { Authorizable } from "../../../domain/model/aggregates/vote-authorization.aggregate.js";
import { CastVoteCommand } from "../../../domain/model/commands/cast-vote.command.js";
import { MarkVoteConfirmedCommand } from "../../../domain/model/commands/mark-vote-confirmed.command.js";
import { MarkVoteFailedCommand } from "../../../domain/model/commands/mark-vote-failed.command.js";
import { MarkVoteQueuedCommand } from "../../../domain/model/commands/mark-vote-queued.command.js";
import { MarkVoteSentCommand } from "../../../domain/model/commands/mark-vote-sent.command.js";
import { EIP712Signature } from "../../../domain/model/valueobjects/eip712-signature.value-object.js";
import { LateVoteRejectedEvent } from "../../../domain/model/events/late-vote-rejected.event.js";
import { ReplayRejectedEvent } from "../../../domain/model/events/replay-rejected.event.js";
import { VoteId } from "../../../domain/model/valueobjects/vote-id.value-object.js";
import { VoteNonce } from "../../../domain/model/valueobjects/vote-nonce.value-object.js";
import { VoterAddress } from "../../../domain/model/valueobjects/voter-address.value-object.js";
import { AuthorizationNotFoundError } from "../../../domain/exceptions/authorization-not-found.error.js";
import { ProposalNotOpenError } from "../../../domain/exceptions/proposal-not-open.error.js";
import { ProposalNotFoundError } from "../../../domain/exceptions/proposal-not-found.error.js";
import { ReplayRejectedError } from "../../../domain/exceptions/replay-rejected.error.js";
import { VoteNotFoundError } from "../../../domain/exceptions/vote-not-found.error.js";
import { AUTHORIZATION_REPOSITORY } from "../../../domain/repositories/authorization.repository.js";
import type { VoteAuthorizationRepository } from "../../../domain/repositories/authorization.repository.js";
import { PROPOSAL_REPOSITORY } from "../../../domain/repositories/proposal.repository.js";
import type { ProposalRepository } from "../../../domain/repositories/proposal.repository.js";
import { VOTE_REPOSITORY } from "../../../domain/repositories/vote.repository.js";
import type { VoteRepository } from "../../../domain/repositories/vote.repository.js";
import { VoteCommandService } from "../../../domain/services/vote-command.service.js";
import { type ExternalNotificationsService } from "../outboundservices/acl/external-notifications.service.js";
import { type ExternalWalletService } from "../outboundservices/acl/external-wallet.service.js";
import { IDEMPOTENCY_KEY_STORE } from "../outboundservices/idempotency/idempotency-key-store.service.js";
import type { IdempotencyKeyStore } from "../outboundservices/idempotency/idempotency-key-store.service.js";
import { SIGNATURE_POLICY } from "../outboundservices/signing/signature-policy.service.js";
import type { SignaturePolicy } from "../outboundservices/signing/signature-policy.service.js";

/**
 * Application orchestration for UC4 (anchor) + UC5/UC6 tracking.
 *
 * UC4: guards (auth PENDING, proposal OPEN, choice valid) → buildMessage →
 * wallet.sign (R4, real custody: reconstruct → sign transient → forget) →
 * recoverSigner == voter (real EIP-712 ecrecover) → single `uow.run()`
 * (re-read auth → consume → cast → save both) → post-commit publish →
 * notifications.voteCast (R11). A failed persist discards the signature:
 * retry is a new CastVoteCommand against the still-PENDING auth. UC4 never
 * re-asks eligibility or liveness (trusts the UC3 frozen copy).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class VoteCommandServiceImpl implements VoteCommandService {
  constructor(
    @Inject(PROPOSAL_REPOSITORY) private readonly proposals: ProposalRepository,
    @Inject(AUTHORIZATION_REPOSITORY) private readonly auths: VoteAuthorizationRepository,
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    private readonly wallet: ExternalWalletService,
    @Inject(SIGNATURE_POLICY) private readonly signatures: SignaturePolicy,
    private readonly notifications: ExternalNotificationsService,
    @Inject(IDEMPOTENCY_KEY_STORE) private readonly idempotency: IdempotencyKeyStore,
  ) {}

  /**
   * Casts once per idempotency key, recording key→voteId for replays.
   * @inheritdoc
   */
  async castVoteIdempotent(command: CastVoteCommand, key: string): Promise<{ voteId: VoteId; replayed: boolean }> {
    const existing = await this.idempotency.findVoteIdByKey(key);
    if (existing) return { voteId: VoteId.of(existing), replayed: true };
    const voteId = await this.castVote(command);
    try {
      await this.idempotency.saveVoteId(key, voteId.value);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await this.idempotency.findVoteIdByKey(key);
      if (!raced) throw error;
      return { voteId: VoteId.of(raced), replayed: true };
    }
    return { voteId, replayed: false };
  }

  async castVote(command: CastVoteCommand): Promise<VoteId> {
    const auth = await this.auths.findById(command.authorizationId);
    if (!auth) throw new AuthorizationNotFoundError('authorization not found');
    if (auth.isConsumedOrExpired()) {
      // Replay/late guard BEFORE any signature is produced: the wallet is never
      // reached a second time. The rejection fact is published so affected
      // parties observe the refused replay (use-case §3 / §guards).
      this.events.emit(ReplayRejectedEvent.eventName,
        new ReplayRejectedEvent(auth.proposalId, auth.voterAddress, 'authorization consumed or expired'));
      throw new ReplayRejectedError('ReplayRejected');
    }
    const proposal = await this.proposals.findById(auth.proposalId);
    if (!proposal) throw new ProposalNotFoundError('proposal not found');
    if (!proposal.isOpen()) {
      this.events.emit(LateVoteRejectedEvent.eventName,
        new LateVoteRejectedEvent(auth.proposalId, auth.voterAddress, 'proposal not open'));
      throw new ProposalNotOpenError('ProposalNotOpen');
    }
    proposal.assertChoice(command.choice);
    const nonce = VoteNonce.fresh();
    const contentRef = Vote.buildMessage(proposal.id, auth.voterAddress, command.choice, nonce);
    const sigRaw = await this.wallet.sign(auth.personId.value, contentRef);
    const recovered = VoterAddress.of(await this.signatures.recoverSigner(contentRef, sigRaw));
    const vote = await this.uow.run(async () => {
      const fresh = await this.auths.findById(command.authorizationId);
      if (!fresh) throw new AuthorizationNotFoundError('authorization not found');
      const freshProposal = await this.proposals.findById(fresh.proposalId);
      if (!freshProposal) throw new ProposalNotFoundError('proposal not found');
      freshProposal.assertOpen();
      freshProposal.assertChoice(command.choice);
      const voteId = VoteId.generate();
      fresh.consume(voteId);
      const v = Vote.cast(voteId, fresh.proposalId, fresh.voterAddress, command.choice, nonce,
        EIP712Signature.from(sigRaw), recovered);
      await this.auths.save(fresh);
      await this.votes.save(v);
      return { auth: fresh, vote: v };
    });
    this.publishAuth(vote.auth);
    this.publishVote(vote.vote);
    await this.notifications.voteCast(auth.voterAddress.value, vote.vote.id.value);
    return vote.vote.id;
  }

  async markVoteQueued(command: MarkVoteQueuedCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const v = await this.require(command.voteId.value);
      v.markQueued();
      await this.votes.save(v);
      return v;
    });
    this.publishVote(updated);
  }

  async markVoteSent(command: MarkVoteSentCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const v = await this.require(command.voteId.value);
      v.markSent(command.reference);
      await this.votes.save(v);
      return v;
    });
    this.publishVote(updated);
  }

  async markVoteConfirmed(command: MarkVoteConfirmedCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const v = await this.require(command.voteId.value);
      v.markConfirmed(command.reference, command.blockNo);
      await this.votes.save(v);
      return v;
    });
    this.publishVote(updated);
  }

  async markVoteFailed(command: MarkVoteFailedCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const v = await this.require(command.voteId.value);
      v.markFailed(command.reason, command.retryable);
      await this.votes.save(v);
      return v;
    });
    this.publishVote(updated);
  }

  private async require(id: string): Promise<Vote> {
    const vote = await this.votes.findById(VoteId.of(id));
    if (!vote) throw new VoteNotFoundError('vote not found');
    return vote;
  }

  private publishVote(vote: VoteTrackable & { pullDomainEvents(): { eventName: string }[] }): void {
    for (const e of vote.pullDomainEvents()) this.events.emit(e.eventName, e);
  }

  private publishAuth(auth: Authorizable & { pullDomainEvents(): { eventName: string }[] }): void {
    for (const e of auth.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}

/**
 * Postgres unique-violation on the idempotency key row: a lost double-submit
 * race, replayed as success instead of surfaced as a conflict.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code: unknown }).code === '23505';
}
