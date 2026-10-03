import { Choice } from "./choice.value-object.js";
import { ProposalId } from "./proposal-id.value-object.js";
import { VoteId } from "./vote-id.value-object.js";
import { VoteStatus } from "./vote-status.value-object.js";
import { VoterAddress } from "./voter-address.value-object.js";

/**
 * My journey on a proposal: my vote's choice, status and chain reference —
 * never anyone else's choices. Identity travels as typed value objects,
 * never bare strings.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class VoterReceipt {
  private constructor(
    public readonly voteId: VoteId,
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly choice: Choice,
    public readonly status: VoteStatus,
    public readonly txHash: string | null,
  ) {}

  static from(input: {
    voteId: VoteId; proposalId: ProposalId; voterAddress: VoterAddress;
    choice: Choice; status: VoteStatus; txHash: string | null;
  }): VoterReceipt {
    return new VoterReceipt(
      input.voteId, input.proposalId, input.voterAddress,
      input.choice, input.status, input.txHash,
    );
  }

  equals(o: VoterReceipt): boolean {
    return this.voteId.equals(o.voteId)
      && this.proposalId.equals(o.proposalId)
      && this.voterAddress.equals(o.voterAddress)
      && this.choice.equals(o.choice)
      && this.status === o.status
      && this.txHash === o.txHash;
  }
}
