import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";
import { ErasureStanding } from "../valueobjects/consent-standings.value-object.js";
import { ErasureOwner } from "../valueobjects/erasure-owner.value-object.js";
import type { RevocationConfirmations } from "../valueobjects/revocation-confirmations.value-object.js";
import { ErasureIncompleteError } from "../../exceptions/erasure-incomplete.error.js";
import { ErasureNotConfirmedError } from "../../exceptions/erasure-not-confirmed.error.js";
import { UnknownOwnerConfirmationError } from "../../exceptions/unknown-owner-confirmation.error.js";
import {
  ErasureCompletedEvent,
  ErasureConfirmedEvent,
  ErasureRequestedEvent,
  RevocationConfirmedEvent,
  RevocationCoordinatedEvent,
} from "../events/consent.events.js";

export interface RequestLifecycle {
  confirm(): void;
  coordinateRevocation(owners: ErasureOwner[]): void;
  recordConfirmation(owner: ErasureOwner): void;
  complete(): void;
}

/**
 * One erasure flow, request â†’ completion, with per-owner confirmations.
 * Coordinates â€” never executes another context's deletion.
 */
export class DataSubjectRequest extends AggregateRoot implements RequestLifecycle {
  private constructor(
    private readonly _id: DataSubjectRequestId,
    private readonly _personId: PersonId,
    private _standing: ErasureStanding,
    private readonly _confirmations: RevocationConfirmations,
  ) { super(); }

  static submit(p: { id: DataSubjectRequestId; personId: PersonId; confirmations: RevocationConfirmations }): DataSubjectRequest {
    const r = new DataSubjectRequest(p.id, p.personId, ErasureStanding.REQUESTED, p.confirmations);
    r.registerEvent(new ErasureRequestedEvent(r._id, r._personId));
    return r;
  }

  static rehydrate(p: { id: DataSubjectRequestId; personId: PersonId; standing: ErasureStanding; confirmations: RevocationConfirmations }): DataSubjectRequest {
    return new DataSubjectRequest(p.id, p.personId, p.standing, p.confirmations);
  }

  protected requireStanding(expected: ErasureStanding): void {
    if (this._standing !== expected) throw new ErasureNotConfirmedError(`expected ${expected}, was ${this._standing}`);
  }

  protected moveTo(next: ErasureStanding): void { this._standing = next; }

  confirm(): void {
    this.requireStanding(ErasureStanding.REQUESTED);
    this.moveTo(ErasureStanding.CONFIRMED);
    this.registerEvent(new ErasureConfirmedEvent(this._id, this._personId));
  }

  coordinateRevocation(owners: ErasureOwner[]): void {
    this.requireStanding(ErasureStanding.CONFIRMED);
    this._confirmations.askOwners(owners);
    this.moveTo(ErasureStanding.COORDINATED);
    for (const o of owners) this.registerEvent(new RevocationCoordinatedEvent(this._id, this._personId, o));
    this.moveTo(ErasureStanding.AWAITING_CONFIRMATIONS);
  }

  recordConfirmation(owner: ErasureOwner): void {
    if (!this._confirmations.isAsked(owner)) throw new UnknownOwnerConfirmationError(`owner never coordinated: ${owner.value}`);
    if (this._confirmations.record(owner)) this.registerEvent(new RevocationConfirmedEvent(this._id, this._personId, owner));
  }

  complete(): void {
    if (!this._confirmations.allConfirmed()) throw new ErasureIncompleteError('every coordinated owner must confirm first');
    this._standing = ErasureStanding.COMPLETED;
    this.registerEvent(new ErasureCompletedEvent(this._id, this._personId));
  }

  answerStanding(): { standing: ErasureStanding; pending: string[]; confirmed: string[] } {
    return { standing: this._standing, pending: this._confirmations.pending(), confirmed: this._confirmations.confirmed() };
  }

  get id(): DataSubjectRequestId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get standing(): ErasureStanding { return this._standing; }
  get confirmations(): RevocationConfirmations { return this._confirmations; }
}
