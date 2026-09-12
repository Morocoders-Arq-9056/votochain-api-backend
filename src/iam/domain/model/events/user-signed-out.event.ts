import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { SignOutReason } from "../valueobjects/sign-out-reason.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class UserSignedOutEvent implements DomainEvent {
  static readonly eventName = 'UserSignedOut';
  readonly eventName = UserSignedOutEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly reason: SignOutReason,
  ) {}
}
