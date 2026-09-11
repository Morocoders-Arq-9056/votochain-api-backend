import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ContactAddress } from "../valueobjects/contact-address.js";
import { PersonId } from "../valueobjects/person-id.js";
import { UserId } from "../valueobjects/user-id.js";

export class UserSignedUpEvent implements DomainEvent {
  static readonly eventName = 'UserSignedUp';
  readonly eventName = UserSignedUpEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly contact: ContactAddress,
  ) {}
}
