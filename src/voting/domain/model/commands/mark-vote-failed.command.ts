import { VoteFailureReason } from "../valueobjects/vote-failure-reason.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class MarkVoteFailedCommand {
  constructor(
    public readonly voteId: VoteId,
    public readonly reason: VoteFailureReason,
    public readonly retryable: boolean,
  ) {
    if (!voteId) throw new Error('voteId required');
    if (!reason) throw new Error('reason required');
  }
}
