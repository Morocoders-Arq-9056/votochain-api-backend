import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { SignerMismatchError } from "../../exceptions/signer-mismatch.error.js";
import { IllegalProposalTransitionError } from "../../exceptions/illegal-proposal-transition.error.js";
import { Choice } from "../valueobjects/choice.value-object.js";
import { EIP712Signature } from "../valueobjects/eip712-signature.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { TransactionReference } from "../valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";
import { VoteNonce } from "../valueobjects/vote-nonce.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";
import { VoteStatus } from "../valueobjects/vote-status.value-object.js";
import { SignedVoteQueuedEvent } from "../events/signed-vote-queued.event.js";
import { TransactionFailedEvent } from "../events/transaction-failed.event.js";
import { TransactionSentEvent } from "../events/transaction-sent.event.js";
import { VoteCastEvent } from "../events/vote-cast.event.js";
import { VoteConfirmedOnChainEvent } from "../events/vote-confirmed-on-chain.event.js";
import { VoteMessageBuiltEvent } from "../events/vote-message-built.event.js";

/**
 * Lifecycle contract of a vote on its way to the chain.
 */
export interface VoteTrackable {
  markQueued(): void;
  markSent(ref: TransactionReference): void;
  markConfirmed(ref: TransactionReference, blockNo: number): void;
  markFailed(reason: string, retryable: boolean): void;
}

/**
 * Vote aggregate: SIGNED / QUEUED / SENT → CONFIRMED / FAILED. Immutable
 * intent; machine retries reuse identity + signature. A second CONFIRMED per
 * (proposal, voter) is replay, not a vote.
 */
export class Vote extends AggregateRoot implements VoteTrackable {
  private constructor(
    private readonly _id: VoteId,
    private readonly _proposalId: ProposalId,
    private readonly _voterAddress: VoterAddress,
    private readonly _choice: Choice,
    private readonly _nonce: VoteNonce,
    private readonly _signature: EIP712Signature,
    private _reference: TransactionReference | null,
    private _status: VoteStatus,
  ) { super(); }

  /** Assembles the signable content (pure, no events): proposal + voter + choice + nonce. */
  static buildMessage(proposalId: ProposalId, voter: VoterAddress, choice: Choice, nonce: VoteNonce): string {
    return `vote:${proposalId.value}:${voter.value}:${choice.value}:${nonce.value}`;
  }

  static cast(id: VoteId, proposalId: ProposalId, voter: VoterAddress, choice: Choice, nonce: VoteNonce, sig: EIP712Signature, recovered: VoterAddress): Vote {
    if (!recovered.equals(voter)) throw new SignerMismatchError('SignerMismatch');
    const vote = new Vote(id, proposalId, voter, choice, nonce, sig, null, VoteStatus.SIGNED);
    vote.registerEvent(new VoteMessageBuiltEvent(id, proposalId, choice, nonce));
    vote.registerEvent(new VoteCastEvent(id, proposalId, voter, sig));
    return vote;
  }

  static rehydrate(input: { id: VoteId; proposalId: ProposalId; voterAddress: VoterAddress; choice: Choice; nonce: VoteNonce; signature: EIP712Signature; reference: TransactionReference | null; status: VoteStatus }): Vote {
    return new Vote(input.id, input.proposalId, input.voterAddress, input.choice, input.nonce, input.signature, input.reference, input.status);
  }

  markQueued(): void {
    if (this._status !== VoteStatus.SIGNED && this._status !== VoteStatus.FAILED)
      throw new IllegalProposalTransitionError('queue only from SIGNED/FAILED');
    this._status = VoteStatus.QUEUED;
    this.registerEvent(new SignedVoteQueuedEvent(this._id, this._proposalId));
  }

  markSent(ref: TransactionReference): void {
    if (this._status !== VoteStatus.QUEUED) throw new IllegalProposalTransitionError('send only from QUEUED');
    this._reference = ref;
    this._status = VoteStatus.SENT;
    this.registerEvent(new TransactionSentEvent(this._id, ref));
  }

  markConfirmed(ref: TransactionReference, blockNo: number): void {
    if (this._status !== VoteStatus.SENT) throw new IllegalProposalTransitionError('confirm only from SENT');
    this._reference = ref;
    this._status = VoteStatus.CONFIRMED;
    this.registerEvent(new VoteConfirmedOnChainEvent(this._id, ref, blockNo));
  }

  markFailed(reason: string, retryable: boolean): void {
    if (this._status === VoteStatus.CONFIRMED) throw new IllegalProposalTransitionError('CONFIRMED is terminal');
    this._status = VoteStatus.FAILED;
    this.registerEvent(new TransactionFailedEvent(this._id, reason, retryable));
  }

  get id(): VoteId { return this._id; }
  get proposalId(): ProposalId { return this._proposalId; }
  get voterAddress(): VoterAddress { return this._voterAddress; }
  get choice(): Choice { return this._choice; }
  get nonce(): VoteNonce { return this._nonce; }
  get signature(): EIP712Signature { return this._signature; }
  get reference(): TransactionReference | null { return this._reference; }
  get status(): VoteStatus { return this._status; }
}
