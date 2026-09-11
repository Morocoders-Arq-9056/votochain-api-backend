import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { OutsideProverRef } from "../valueobjects/outside-prover-ref.js";
import { PersonId } from "../valueobjects/person-id.js";
import { UserId } from "../valueobjects/user-id.js";

export class OutsideIdentityUnlinkedEvent implements DomainEvent {
  static readonly eventName = 'OutsideIdentityUnlinked';
  readonly eventName = OutsideIdentityUnlinkedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly prover: OutsideProverRef,
  ) {}
}