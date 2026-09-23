import { randomUUID } from 'node:crypto';

/**
 * Value object representing a unique identifier for a challenge within the VotoChain Platform.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export class ChallengeId {
  /**
   * Creates a new ChallengeId instance.
   * @param value The value of the challenge ID.
   */
  private constructor(public readonly value: string) {}

  /**
   * Generates a new ChallengeId with a unique identifier.
   * @returns A new instance of ChallengeId with a unique identifier.
   */
  static generate(): ChallengeId { return new ChallengeId(`ch-${randomUUID()}`); }

  /**
   * Creates a ChallengeId instance from a given string value.
   * @param v The string value to create the ChallengeId from.
   * @returns A new instance of ChallengeId with the provided value.
   */
  static of(v: string): ChallengeId { if (!v?.trim()) throw new Error('invalid challenge id'); return new ChallengeId(v); }

  /**
   * Compares the current ChallengeId instance with another ChallengeId instance for equality.
   * @param o The other ChallengeId instance to compare with. 
   * @returns True if both ChallengeId instances have the same value, otherwise false.
   */
  equals(o: ChallengeId): boolean { return this.value === o.value; }
}