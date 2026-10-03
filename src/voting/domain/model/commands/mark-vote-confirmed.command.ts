import { TransactionReference } from "../valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";

export class MarkVoteConfirmedCommand {
  constructor(
    public readonly voteId: VoteId,
    public readonly reference: TransactionReference,
    public readonly blockNo: number,
  ) {
    if (!voteId) throw new Error('voteId required');
    if (!reference) throw new Error('reference required');
    if (!Number.isInteger(blockNo)) throw new Error('blockNo required');
  }
}
