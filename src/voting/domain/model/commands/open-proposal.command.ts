import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class OpenProposalCommand {
  constructor(public readonly proposalId: ProposalId) {
    if (!proposalId) throw new Error('proposalId required');
  }
}
