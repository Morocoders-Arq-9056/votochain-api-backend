import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Command suspending an ACTIVE or DELINQUENT membership.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class SuspendMembershipCommand {
  /**
   * Creates the command.
   * @param membershipId Membership identity.
   * @param reason Recorded suspension reason.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly reason: string,
  ) {
    if (!membershipId) throw new Error('membershipId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
