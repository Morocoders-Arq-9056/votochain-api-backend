import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class MarkVoteFailedCommand {
  constructor(
    public readonly voteId: VoteId,
    public readonly reason: string,
    public readonly retryable: boolean,
  ) {
    if (!voteId) throw new Error('voteId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
