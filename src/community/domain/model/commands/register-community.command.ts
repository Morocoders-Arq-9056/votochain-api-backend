import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { CommunitySettings } from "../valueobjects/community-settings.value-object.js";

export class RegisterCommunityCommand {
  constructor(
    public readonly settings: CommunitySettings,
    public readonly personId: PersonId,
  ) {
    if (!settings) throw new Error('settings required');
    if (!personId) throw new Error('personId required');
  }
}
