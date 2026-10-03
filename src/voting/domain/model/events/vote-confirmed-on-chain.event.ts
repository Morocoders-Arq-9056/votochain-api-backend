import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { TransactionReference } from "../valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class VoteConfirmedOnChainEvent implements DomainEvent {
  static readonly eventName = 'VoteConfirmedOnChain';
  readonly eventName = VoteConfirmedOnChainEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly reference: TransactionReference,
    public readonly blockNo: number,
  ) {}
}
