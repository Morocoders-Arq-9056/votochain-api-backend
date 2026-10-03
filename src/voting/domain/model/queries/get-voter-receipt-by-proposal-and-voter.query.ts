import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class GetVoterReceiptByProposalAndVoterQuery {
  constructor(
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
  ) {
    if (!proposalId) throw new Error('proposalId required');
    if (!voterAddress) throw new Error('voterAddress required');
  }
}
