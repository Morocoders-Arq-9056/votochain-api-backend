import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Command activating a REQUESTED membership.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class ActivateMembershipCommand {
  /**
   * Creates the command.
   * @param membershipId Membership identity.
   */
  constructor(public readonly membershipId: MembershipId) {
    if (!membershipId) throw new Error('membershipId required');
  }
}
