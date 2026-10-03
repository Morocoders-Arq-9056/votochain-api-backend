import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class GetTallyByProposalQuery {
  constructor(public readonly proposalId: ProposalId) {
    if (!proposalId) throw new Error('proposalId required');
  }
}
