import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { CommunitySettings } from "../valueobjects/community-settings.value-object.js";

export class UpdateCommunitySettingsCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly settings: CommunitySettings,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!settings) throw new Error('settings required');
  }
}
