import { CommunityId } from "../valueobjects/community-id.value-object.js";

export class ArchiveCommunityCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly reason: string,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
