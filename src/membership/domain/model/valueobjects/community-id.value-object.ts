import { randomUUID } from "node:crypto";

/**
 * Local reference to a community owned by Community Management (acceptance
 * is judged outside, via ExternalCommunityService). Same shape as the
 * community context's own CommunityId so boundary strings translate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class CommunityId {
  /** Creates the reference; use {@link CommunityId.of} or {@link CommunityId.generate}. */
  private constructor(public readonly value: string) {}

  /**
   * Mints a fresh community reference (`com-` prefixed).
   * @returns A new CommunityId with a unique value.
   */
  static generate(): CommunityId { return new CommunityId(`com-${randomUUID()}`); }

  /**
   * Rebuilds a reference from a boundary string.
   * @param v Raw community id string.
   */
  static of(v: string): CommunityId {
    if (!v?.trim()) throw new Error('invalid community id');
    return new CommunityId(v);
  }

  /**
   * Value comparison.
   * @param o Other reference.
   */
  equals(o: CommunityId): boolean { return this.value === o.value; }
}
