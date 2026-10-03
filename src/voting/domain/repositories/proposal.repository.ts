import { Proposal } from "../model/aggregates/proposal.aggregate.js";
import { CommunityId } from "../model/valueobjects/community-id.value-object.js";
import { ProposalId } from "../model/valueobjects/proposal-id.value-object.js";
import { ProposalStatus } from "../model/valueobjects/proposal-status.value-object.js";

export const PROPOSAL_REPOSITORY = Symbol('PROPOSAL_REPOSITORY');

export interface ProposalRepository {
  findById(id: ProposalId): Promise<Proposal | null>;
  findByCommunityAndStatus(communityId: CommunityId, status: ProposalStatus | null): Promise<Proposal[]>;
  save(proposal: Proposal): Promise<void>;
}
