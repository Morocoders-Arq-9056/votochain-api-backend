import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class AccessSuspendedEvent implements DomainEvent {
  static readonly eventName = 'AccessSuspended';
  readonly eventName = AccessSuspendedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly reason: string,
  ) {}
}
