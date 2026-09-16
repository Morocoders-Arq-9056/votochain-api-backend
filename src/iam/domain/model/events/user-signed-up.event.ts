import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ContactAddress } from "../valueobjects/contact-address.value-object.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

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
