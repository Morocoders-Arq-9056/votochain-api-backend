import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { Choice } from "../valueobjects/choice.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";
import { VoteNonce } from "../valueobjects/vote-nonce.value-object.js";

export class VoteMessageBuiltEvent implements DomainEvent {
  static readonly eventName = 'VoteMessageBuilt';
  readonly eventName = VoteMessageBuiltEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly proposalId: ProposalId,
    public readonly choice: Choice,
    public readonly nonce: VoteNonce,
  ) {}
}
