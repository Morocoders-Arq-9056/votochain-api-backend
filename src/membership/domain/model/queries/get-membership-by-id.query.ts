import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Query returning the membership for the given id.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetMembershipByIdQuery {
  /**
   * Creates the query.
   * @param membershipId Membership identity.
   */
  constructor(public readonly membershipId: MembershipId) {
    if (!membershipId) throw new Error('membershipId required');
  }
}
