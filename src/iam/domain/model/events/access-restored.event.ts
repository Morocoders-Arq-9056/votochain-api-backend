import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class AccessRestoredEvent implements DomainEvent {
  static readonly eventName = 'AccessRestored';
  readonly eventName = AccessRestoredEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
  ) {}
}
