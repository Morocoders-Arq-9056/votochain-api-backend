import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ProofKind } from "../valueobjects/proof-kind.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

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
