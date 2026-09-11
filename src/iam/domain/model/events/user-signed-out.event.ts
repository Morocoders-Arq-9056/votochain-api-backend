import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.js";
import { SignOutReason } from "../valueobjects/sign-out-reason.js";
import { UserId } from "../valueobjects/user-id.js";

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
