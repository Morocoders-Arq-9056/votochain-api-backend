import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { TransactionReference } from "../valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class TransactionSentEvent implements DomainEvent {
  static readonly eventName = 'TransactionSent';
  readonly eventName = TransactionSentEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly reference: TransactionReference,
  ) {}
}
