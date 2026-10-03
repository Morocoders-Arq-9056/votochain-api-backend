import { randomUUID } from "node:crypto";

/**
 * Local reference to a person owned by IAM (existence is judged outside,
 * via ExternalMembershipService/ExternalBiometricService). Same shape as the
 * Membership and shared PersonId so boundary strings translate without
 * importing another context's model.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-29
 */
export class PersonId {
  /** Creates the reference; use {@link PersonId.of} or {@link PersonId.generate}. */
  private constructor(public readonly value: string) {}

  /**
   * Mints a fresh person reference (`per-` prefixed).
   * @returns A new PersonId with a unique value.
   */
  static generate(): PersonId { return new PersonId(`per-${randomUUID()}`); }

  /**
   * Rebuilds a reference from a boundary string.
   * @param v Raw person id string.
   */
  static of(v: string): PersonId {
    if (!v?.trim()) throw new Error('invalid person id');
    return new PersonId(v);
  }

  /**
   * Value comparison.
   * @param o Other reference.
   */
  equals(o: PersonId): boolean { return this.value === o.value; }
}
