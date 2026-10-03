import { Proposal } from "../model/aggregates/proposal.aggregate.js";
import { GetProposalByIdQuery } from "../model/queries/get-proposal-by-id.query.js";
import { GetTallyByProposalQuery } from "../model/queries/get-tally-by-proposal.query.js";
import { ListProposalsByCommunityAndStatusQuery } from "../model/queries/list-proposals-by-community-and-status.query.js";
import { Tally } from "../model/valueobjects/tally.value-object.js";

export const PROPOSAL_QUERY_SERVICE = Symbol('PROPOSAL_QUERY_SERVICE');

/**
 * Domain port for proposal reads (detail, community listing, tally).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */

export interface ProposalQueryService {
  getProposalById(query: GetProposalByIdQuery): Promise<Proposal | null>;
  listProposalsByCommunityAndStatus(query: ListProposalsByCommunityAndStatusQuery): Promise<Proposal[]>;
  getTallyByProposal(query: GetTallyByProposalQuery): Promise<Tally | null>;
}
