import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class GetProposalByIdQuery {
  constructor(public readonly proposalId: ProposalId) {
    if (!proposalId) throw new Error('proposalId required');
  }
}
