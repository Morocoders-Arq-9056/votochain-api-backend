import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { CommunityStanding } from "../valueobjects/community-standing.value-object.js";

export class UpdateCommunityStandingCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly standing: CommunityStanding,
    public readonly reason: string | null,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!standing) throw new Error('standing required');
  }
}
