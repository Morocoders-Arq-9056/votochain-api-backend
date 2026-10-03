/**
 * Value object carrying the executor-observed cause of a failed delivery attempt.
 *
 * The vocabulary comes from the executor webhook (bounce, timeout, rejected);
 * this context records it verbatim as attempt detail, never judges it.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class FailureReason {

  /**
   * Creates a new FailureReason instance.
   *
   * @param value The observed failure cause.
   */
  private constructor(public readonly value: string) {}

  /**
   * Creates a FailureReason instance from a given string value.
   * @param v The observed failure cause.
   * @returns A new instance of FailureReason with the provided value.
   */
  static of(v: string): FailureReason { if (!v?.trim()) throw new Error('invalid failure reason'); return new FailureReason(v); }

  /**
   * Compares the current FailureReason instance with another one for equality.
   * @param o The other FailureReason instance to compare with.
   * @returns True when both instances carry the same value.
   */
  equals(o: FailureReason): boolean { return this.value === o.value; }
}
