import { BallotOptions } from "../valueobjects/ballot-options.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

export class DraftProposalCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly options: BallotOptions,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!options) throw new Error('options required');
  }
}
