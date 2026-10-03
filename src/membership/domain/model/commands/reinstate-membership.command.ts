import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Command reinstating a SUSPENDED membership back to ACTIVE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class ReinstateMembershipCommand {
  /**
   * Creates the command.
   * @param membershipId Membership identity.
   */
  constructor(public readonly membershipId: MembershipId) {
    if (!membershipId) throw new Error('membershipId required');
  }
}
