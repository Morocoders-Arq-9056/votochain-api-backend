import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class EmailVerifiedEvent implements DomainEvent {
  static readonly eventName = 'EmailVerified';
  readonly eventName = EmailVerifiedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly email: string,
  ) {}
}
