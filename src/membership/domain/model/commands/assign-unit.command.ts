import { MembershipId } from "../valueobjects/membership-id.value-object.js";
import { Unit } from "../valueobjects/unit.value-object.js";

/**
 * Command assigning the dwelling unit.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AssignUnitCommand {
  /**
   * Creates the command.
   * @param membershipId Membership identity.
   * @param unit Dwelling unit.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly unit: Unit,
  ) {
    if (!membershipId) throw new Error('membershipId required');
    if (!unit) throw new Error('unit required');
  }
}
