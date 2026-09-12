import { randomUUID } from "node:crypto";
import { SystemRole } from "../valueobjects/system-role.js";

/**
 * Internal entity representing a single system role held by a user.
 * Owned exclusively by the User aggregate root: never instantiated
 * outside it — creation goes through User.grantSystemRole().
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export class SystemRoleAssignment {
  private constructor(
    public readonly id: string,
    public readonly role: SystemRole,
    public readonly grantedAt: Date,
  ) {}

  /**
   * Grants a role: the only creation path for application code,
   * always invoked from the aggregate root (dedup enforced there).
   */
  static grant(role: SystemRole): SystemRoleAssignment {
    return new SystemRoleAssignment(`sra-${randomUUID()}`, role, new Date());
  }

  /**
   * Rebuilds an assignment from persistence. Not for application use —
   * the assembler is its only caller, so grantedAt survives the round-trip.
   */
  static rehydrate(id: string, role: SystemRole, grantedAt: Date): SystemRoleAssignment {
    if (!id?.trim()) throw new Error('assignment id required');
    return new SystemRoleAssignment(id, role, grantedAt);
  }

  equals(o: SystemRoleAssignment): boolean { return this.id === o.id; }
}
