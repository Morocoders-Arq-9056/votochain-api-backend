import { CommunityId } from "../valueobjects/community-id.value-object.js";

export class DefineVotingPolicyCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly threshold: number,
    public readonly basis: string,
    public readonly majorityRule: string,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!Number.isFinite(threshold) || threshold <= 0) throw new Error('threshold must be positive');
    if (!basis?.trim()) throw new Error('basis required');
    if (!majorityRule?.trim()) throw new Error('majorityRule required');
  }
}
