import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.js";
import { ProofKind } from "../valueobjects/proof-kind.js";
import { UserId } from "../valueobjects/user-id.js";

export class UserSignedInEvent implements DomainEvent {
  static readonly eventName = 'UserSignedIn';
  readonly eventName = UserSignedInEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly personId: PersonId,
    public readonly kind: ProofKind,
  ) {}
}
