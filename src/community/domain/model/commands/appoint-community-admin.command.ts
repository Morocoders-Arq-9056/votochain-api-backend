import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

export class AppointCommunityAdminCommand {
  constructor(
    public readonly communityId: CommunityId,
    public readonly personId: PersonId,
  ) {
    if (!communityId) throw new Error('communityId required');
    if (!personId) throw new Error('personId required');
  }
}
