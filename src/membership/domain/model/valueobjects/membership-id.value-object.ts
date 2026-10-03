import { randomUUID } from "node:crypto";

/**
 * Identity of a Membership aggregate (`mem-` prefixed, mirroring the
 * `com-`/`per-` convention of the neighbouring contexts).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipId {
  /** Creates the identifier; use {@link MembershipId.of} or {@link MembershipId.generate}. */
  private constructor(public readonly value: string) {}

  /**
   * Mints a fresh identity for a newly registered membership.
   * @returns A new MembershipId with a unique `mem-` prefixed value.
   */
  static generate(): MembershipId { return new MembershipId(`mem-${randomUUID()}`); }

  /**
   * Rebuilds an identifier from a stored or received value.
   * @param v Raw identifier string.
   */
  static of(v: string): MembershipId {
    if (!v?.trim()) throw new Error('invalid membership id');
    return new MembershipId(v);
  }

  /**
   * Value comparison.
   * @param o Other identifier.
   */
  equals(o: MembershipId): boolean { return this.value === o.value; }
}
