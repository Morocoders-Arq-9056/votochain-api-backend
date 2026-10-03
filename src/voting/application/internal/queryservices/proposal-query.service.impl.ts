import { Inject, Injectable } from "@nestjs/common";
import { Proposal } from "../../../domain/model/aggregates/proposal.aggregate.js";
import { GetProposalByIdQuery } from "../../../domain/model/queries/get-proposal-by-id.query.js";
import { GetTallyByProposalQuery } from "../../../domain/model/queries/get-tally-by-proposal.query.js";
import { ListProposalsByCommunityAndStatusQuery } from "../../../domain/model/queries/list-proposals-by-community-and-status.query.js";
import { Tally } from "../../../domain/model/valueobjects/tally.value-object.js";
import { PROPOSAL_REPOSITORY } from "../../../domain/repositories/proposal.repository.js";
import type { ProposalRepository } from "../../../domain/repositories/proposal.repository.js";
import { ProposalQueryService } from "../../../domain/services/proposal-query.service.js";

/**
 * Read-side application service: proposal detail, community listing, tally.
 * No mutations, no events.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ProposalQueryServiceImpl implements ProposalQueryService {
  constructor(@Inject(PROPOSAL_REPOSITORY) private readonly proposals: ProposalRepository) {}

  async getProposalById(query: GetProposalByIdQuery): Promise<Proposal | null> {
    return this.proposals.findById(query.proposalId);
  }

  async listProposalsByCommunityAndStatus(query: ListProposalsByCommunityAndStatusQuery): Promise<Proposal[]> {
    return this.proposals.findByCommunityAndStatus(query.communityId, query.status);
  }

  async getTallyByProposal(query: GetTallyByProposalQuery): Promise<Tally | null> {
    const proposal = await this.proposals.findById(query.proposalId);
    return proposal?.tally ?? null;
  }
}
