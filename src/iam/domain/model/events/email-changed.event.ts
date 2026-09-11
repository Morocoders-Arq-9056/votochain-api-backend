import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.js";
import { UserId } from "../valueobjects/user-id.js";

export class EmailChangedEvent implements DomainEvent {
  static readonly eventName = 'EmailChanged';
  readonly eventName = EmailChangedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly oldEmail: string,
    public readonly newEmail: string,
  ) {}
}