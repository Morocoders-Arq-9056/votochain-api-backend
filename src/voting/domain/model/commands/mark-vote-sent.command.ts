import { TransactionReference } from "../valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class MarkVoteSentCommand {
  constructor(
    public readonly voteId: VoteId,
    public readonly reference: TransactionReference,
  ) {
    if (!voteId) throw new Error('voteId required');
    if (!reference) throw new Error('reference required');
  }
}
