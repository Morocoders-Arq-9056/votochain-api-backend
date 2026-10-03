import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class MarkVoteQueuedCommand {
  constructor(public readonly voteId: VoteId) {
    if (!voteId) throw new Error('voteId required');
  }
}
