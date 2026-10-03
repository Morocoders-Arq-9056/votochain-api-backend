import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class VoteAuthorizationConsumedEvent implements DomainEvent {
  static readonly eventName = 'VoteAuthorizationConsumed';
  readonly eventName = VoteAuthorizationConsumedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly voteId: VoteId,
  ) {}
}
