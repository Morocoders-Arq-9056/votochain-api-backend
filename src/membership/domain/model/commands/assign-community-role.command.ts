import { CommunityRole } from "../valueobjects/community-role.value-object.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Command assigning the community role.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AssignCommunityRoleCommand {
  /**
   * Creates the command.
   * @param membershipId Membership identity.
   * @param role Community role.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly role: CommunityRole,
  ) {
    if (!membershipId) throw new Error('membershipId required');
    if (!role) throw new Error('role required');
  }
}
