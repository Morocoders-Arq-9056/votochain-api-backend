import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";
import { VoteFailureReason } from "../valueobjects/vote-failure-reason.value-object.js";

export class TransactionFailedEvent implements DomainEvent {
  static readonly eventName = 'TransactionFailed';
  readonly eventName = TransactionFailedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly reason: VoteFailureReason,
    public readonly retryable: boolean,
  ) {}
}
