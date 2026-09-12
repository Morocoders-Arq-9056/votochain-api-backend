import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { OutsideProverRef } from "../valueobjects/outside-prover-ref.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class OutsideIdentityLinkedEvent implements DomainEvent {
  static readonly eventName = 'OutsideIdentityLinked';
  readonly eventName = OutsideIdentityLinkedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly prover: OutsideProverRef,
  ) {}
}