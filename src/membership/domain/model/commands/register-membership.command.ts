import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { Unit } from "../valueobjects/unit.value-object.js";

/**
 * Command registering a fresh (person, community) pair.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RegisterMembershipCommand {
  /**
   * Creates the command.
   * @param personId Person joining.
   * @param communityId Community joined.
   * @param unit Dwelling unit, when known at registration.
   */
  constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
    public readonly unit: Unit | null = null,
  ) {
    if (!personId) throw new Error('personId required');
    if (!communityId) throw new Error('communityId required');
  }
}
