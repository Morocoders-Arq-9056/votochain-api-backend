import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { AuthorizationAlreadyConsumedError } from "../../exceptions/authorization-already-consumed.error.js";
import { AuthorizationExpiredError } from "../../exceptions/authorization-expired.error.js";
import { IllegalProposalTransitionError } from "../../exceptions/illegal-proposal-transition.error.js";
import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { AuthorizationStatus } from "../valueobjects/authorization-status.value-object.js";
import { EligibilitySnapshot } from "../valueobjects/eligibility-snapshot.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";
import { AuthorizationDenialReason } from "../valueobjects/authorization-denial-reason.value-object.js";
import { VoteAuthorizationConsumedEvent } from "../events/vote-authorization-consumed.event.js";
import { VoteAuthorizationDeniedEvent } from "../events/vote-authorization-denied.event.js";
import { VoteAuthorizationExpiredEvent } from "../events/vote-authorization-expired.event.js";
import { VoteAuthorizationGrantedEvent } from "../events/vote-authorization-granted.event.js";
import { VoteAuthorizationRequestedEvent } from "../events/vote-authorization-requested.event.js";

/**
 * Lifecycle contract of a vote authorization.
 */
export interface Authorizable {
  grant(eligibility: EligibilitySnapshot): void;
  deny(reason: AuthorizationDenialReason): void;
  consume(voteId: VoteId): void;
  expire(): void;
}

/**
 * VoteAuthorization aggregate: PENDING → CONSUMED / EXPIRED / DENIED.
 * At most one PENDING per (proposal, voter); consume+cast is one atomic step.
 */
export class VoteAuthorization extends AggregateRoot implements Authorizable {
  private constructor(
    private readonly _id: AuthorizationId,
    private readonly _proposalId: ProposalId,
    private readonly _voterAddress: VoterAddress,
    private readonly _personId: PersonId,
    private _status: AuthorizationStatus,
    private _eligibility: EligibilitySnapshot | null,
    private _denialReason: AuthorizationDenialReason | null,
    private readonly _expiresAt: Date,
  ) { super(); }

  static request(id: AuthorizationId, proposalId: ProposalId, voter: VoterAddress, personId: PersonId, ttlMinutes: number): VoteAuthorization {
    const auth = new VoteAuthorization(id, proposalId, voter, personId, AuthorizationStatus.PENDING, null, null,
      new Date(Date.now() + ttlMinutes * 60_000));
    auth.registerEvent(new VoteAuthorizationRequestedEvent(id, proposalId, voter));
    return auth;
  }

  static rehydrate(input: { id: AuthorizationId; proposalId: ProposalId; voterAddress: VoterAddress; personId: PersonId; status: AuthorizationStatus; eligibility: EligibilitySnapshot | null; denialReason: AuthorizationDenialReason | null; expiresAt: Date }): VoteAuthorization {
    return new VoteAuthorization(input.id, input.proposalId, input.voterAddress, input.personId, input.status, input.eligibility, input.denialReason, input.expiresAt);
  }

  grant(eligibility: EligibilitySnapshot): void {
    this.assertPending();
    this.assertFresh();
    // No status transition: a granted authorization stays PENDING (consumable)
    // until consume()/deny()/expire() moves it; the frozen snapshot marks the grant.
    this._eligibility = eligibility;
    this.registerEvent(new VoteAuthorizationGrantedEvent(this._id, this._proposalId, this._voterAddress, eligibility));
  }

  deny(reason: AuthorizationDenialReason): void {
    this.assertPending();
    this._denialReason = reason;
    this._status = AuthorizationStatus.DENIED;
    this.registerEvent(new VoteAuthorizationDeniedEvent(this._id, this._proposalId, this._voterAddress, reason));
  }

  consume(voteId: VoteId): void {
    if (this._status !== AuthorizationStatus.PENDING) throw new AuthorizationAlreadyConsumedError('AuthorizationAlreadyConsumed');
    if (this.isExpired()) throw new AuthorizationExpiredError('AuthorizationExpired');
    this._status = AuthorizationStatus.CONSUMED;
    this.registerEvent(new VoteAuthorizationConsumedEvent(this._id, voteId));
  }

  expire(): void {
    if (this._status !== AuthorizationStatus.PENDING) throw new IllegalProposalTransitionError('expire only from PENDING');
    if (!this.isExpired()) throw new IllegalProposalTransitionError('authorization still fresh');
    this._status = AuthorizationStatus.EXPIRED;
    this.registerEvent(new VoteAuthorizationExpiredEvent(this._id, this._proposalId, this._voterAddress));
  }

  isExpired(): boolean { return new Date() >= this._expiresAt; }

  isConsumedOrExpired(): boolean { return this._status !== AuthorizationStatus.PENDING || this.isExpired(); }

  private assertPending(): void {
    if (this._status !== AuthorizationStatus.PENDING) throw new AuthorizationAlreadyConsumedError('AuthorizationAlreadyConsumed');
  }

  private assertFresh(): void {
    if (this.isExpired()) throw new AuthorizationExpiredError('AuthorizationExpired');
  }

  get id(): AuthorizationId { return this._id; }
  get proposalId(): ProposalId { return this._proposalId; }
  get voterAddress(): VoterAddress { return this._voterAddress; }
  get personId(): PersonId { return this._personId; }
  get status(): AuthorizationStatus { return this._status; }
  get eligibility(): EligibilitySnapshot | null { return this._eligibility; }
  get denialReason(): AuthorizationDenialReason | null { return this._denialReason; }
  get expiresAt(): Date { return this._expiresAt; }
}
