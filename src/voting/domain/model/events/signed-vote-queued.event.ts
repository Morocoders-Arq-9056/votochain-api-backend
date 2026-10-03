import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class SignedVoteQueuedEvent implements DomainEvent {
  static readonly eventName = 'SignedVoteQueued';
  readonly eventName = SignedVoteQueuedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly proposalId: ProposalId,
  ) {}
}
