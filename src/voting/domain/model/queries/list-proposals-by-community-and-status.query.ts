import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { ProposalStatus } from "../valueobjects/proposal-status.value-object.js";

export class ListProposalsByCommunityAndStatusQuery {
  constructor(
    public readonly communityId: CommunityId,
    public readonly status: ProposalStatus | null = null,
  ) {
    if (!communityId) throw new Error('communityId required');
  }
}
