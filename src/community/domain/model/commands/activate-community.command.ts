import { CommunityId } from "../valueobjects/community-id.value-object.js";

export class ActivateCommunityCommand {
  constructor(public readonly communityId: CommunityId) {
    if (!communityId) throw new Error('communityId required');
  }
}
