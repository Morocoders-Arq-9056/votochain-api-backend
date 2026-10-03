import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class TransactionFailedEvent implements DomainEvent {
  static readonly eventName = 'TransactionFailed';
  readonly eventName = TransactionFailedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly reason: string,
    public readonly retryable: boolean,
  ) {}
}
