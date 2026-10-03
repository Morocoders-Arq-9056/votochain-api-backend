import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { VoteAuthorization, type Authorizable } from "../../../domain/model/aggregates/vote-authorization.aggregate.js";
import { DenyVoteAuthorizationCommand } from "../../../domain/model/commands/deny-vote-authorization.command.js";
import { ExpireVoteAuthorizationCommand } from "../../../domain/model/commands/expire-vote-authorization.command.js";
import { GrantVoteAuthorizationCommand } from "../../../domain/model/commands/grant-vote-authorization.command.js";
import { RequestVoteAuthorizationCommand } from "../../../domain/model/commands/request-vote-authorization.command.js";
import { AuthorizationId } from "../../../domain/model/valueobjects/authorization-id.value-object.js";
import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { EligibilitySnapshot } from "../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { AuthorizationNotFoundError } from "../../../domain/exceptions/authorization-not-found.error.js";
import { DuplicatePendingAuthorizationError } from "../../../domain/exceptions/duplicate-pending-authorization.error.js";
import { ProposalNotFoundError } from "../../../domain/exceptions/proposal-not-found.error.js";
import { AUTHORIZATION_REPOSITORY } from "../../../domain/repositories/authorization.repository.js";
import type { VoteAuthorizationRepository } from "../../../domain/repositories/authorization.repository.js";
import { PROPOSAL_REPOSITORY } from "../../../domain/repositories/proposal.repository.js";
import type { ProposalRepository } from "../../../domain/repositories/proposal.repository.js";
import { VoteAuthorizationCommandService } from "../../../domain/services/authorization-command.service.js";
import { type ExternalBiometricService } from "../outboundservices/acl/external-biometric.service.js";
import { type ExternalMembershipService } from "../outboundservices/acl/external-membership.service.js";

/**
 * Application orchestration for UC3: request → freeze eligibility (R2) →
 * liveness gate (R3, AlwaysVerified fake) → grant / deny. The TTL comes from
 * `VOTING_AUTH_TTL_MINUTES` (default 15).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class AuthorizationCommandServiceImpl implements VoteAuthorizationCommandService {
  constructor(
    @Inject(PROPOSAL_REPOSITORY) private readonly proposals: ProposalRepository,
    @Inject(AUTHORIZATION_REPOSITORY) private readonly auths: VoteAuthorizationRepository,
    private readonly membership: ExternalMembershipService,
    private readonly biometric: ExternalBiometricService,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async requestVoteAuthorization(command: RequestVoteAuthorizationCommand): Promise<AuthorizationId> {
    const proposal = await this.proposals.findById(command.proposalId);
    if (!proposal) throw new ProposalNotFoundError('proposal not found');
    if (await this.auths.findPendingByProposalAndVoter(command.proposalId, command.voterAddress))
      throw new DuplicatePendingAuthorizationError('duplicate pending authorization');
    const ttl = this.config.get<number>('VOTING_AUTH_TTL_MINUTES', 15);
    const auth = await this.uow.run(async () => {
      const a = VoteAuthorization.request(AuthorizationId.generate(), command.proposalId, command.voterAddress, ttl);
      await this.auths.save(a);
      return a;
    });
    this.publish(auth);
    // UC3 continues inline: freeze eligibility, then grant or deny.
    const verdict = await this.membership.judgeEligibility(command.personId.value, proposal.communityId.value);
    if (!verdict.eligible || !verdict.snapshot) {
      await this.denyVoteAuthorization(new DenyVoteAuthorizationCommand(auth.id, 'NOT_ELIGIBLE'));
      return auth.id;
    }
    const live = await this.biometric.isVerifiedNow(command.personId.value);
    if (!live.verifiedNow) {
      await this.denyVoteAuthorization(new DenyVoteAuthorizationCommand(auth.id, 'NOT_VERIFIED'));
      return auth.id;
    }
    await this.grantFor(auth.id, verdict.snapshot);
    return auth.id;
  }

  async grantVoteAuthorization(command: GrantVoteAuthorizationCommand): Promise<void> {
    const auth = await this.require(command.authorizationId.value);
    const proposal = await this.proposals.findById(auth.proposalId);
    if (!proposal) throw new ProposalNotFoundError('proposal not found');
    await this.grantFor(command.authorizationId, EligibilitySnapshot.freeze({
      personId: PersonId.of(auth.voterAddress.value), communityId: CommunityId.of(proposal.communityId.value),
      verdict: 'ELIGIBLE', reference: 'manual-grant',
    }));
  }

  async denyVoteAuthorization(command: DenyVoteAuthorizationCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const a = await this.require(command.authorizationId.value);
      a.deny(command.reason);
      await this.auths.save(a);
      return a;
    });
    this.publish(updated);
  }

  async expireVoteAuthorization(command: ExpireVoteAuthorizationCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const a = await this.require(command.authorizationId.value);
      a.expire();
      await this.auths.save(a);
      return a;
    });
    this.publish(updated);
  }

  private async grantFor(id: AuthorizationId, snapshot: EligibilitySnapshot): Promise<void> {
    const updated = await this.uow.run(async () => {
      const a = await this.require(id.value);
      a.grant(snapshot);
      await this.auths.save(a);
      return a;
    });
    this.publish(updated);
  }

  private async require(id: string): Promise<VoteAuthorization> {
    const auth = await this.auths.findById(AuthorizationId.of(id));
    if (!auth) throw new AuthorizationNotFoundError('authorization not found');
    return auth;
  }

  private publish(auth: Authorizable & { pullDomainEvents(): { eventName: string }[] }): void {
    for (const e of auth.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
