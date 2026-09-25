import { randomUUID } from "node:crypto";

/**
 * Value object representing a unique identifier for a community within VotoChain Platform.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityId {

  /**
   * Creates a new CommunityId instance.
   *
   * @param value The value of the community ID.
   */
  private constructor(public readonly value: string) {}

  /**
   * Generates a new CommunityId with a unique identifier.
   * @returns A new instance of CommunityId with a unique identifier.
   */
  static generate(): CommunityId { return new CommunityId(`com-${randomUUID()}`); }

  /**
   * Creates a CommunityId instance from a given string value.
   * @param v The string value to create the CommunityId from.
   * @returns A new instance of CommunityId with the provided value.
   */
  static of(v: string): CommunityId { if (!v?.trim()) throw new Error('invalid community id'); return new CommunityId(v); }

  /**
   * Compares the current CommunityId instance with another CommunityId instance for equality.
   * @param o The other CommunityId instance to compare with.
   * @returns True if both CommunityId instances have the same value, otherwise false.
   */
  equals(o: CommunityId): boolean { return this.value === o.value; }
}
