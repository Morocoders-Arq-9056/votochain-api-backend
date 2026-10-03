/**
 * Value object representing the participation part of the voting policy:
 * threshold plus basis. The part Voting freezes as its QuorumSnapshot.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class QuorumConfig {
  /**
   * Creates a new QuorumConfig instance; use {@link QuorumConfig.of}.
   * @param threshold How much participation is enough.
   * @param basis Enough of what (members, units, weighted).
   */
  private constructor(
    public readonly threshold: number,
    public readonly basis: string,
  ) {
    if (!Number.isFinite(threshold) || threshold <= 0) throw new Error('threshold must be positive');
    if (!basis?.trim()) throw new Error('basis required');
  }

  /**
   * Creates a quorum config from validated parts.
   * @param threshold How much participation is enough.
   * @param basis Enough of what (members, units, weighted).
   */
  static of(threshold: number, basis: string): QuorumConfig {
    return new QuorumConfig(threshold, basis);
  }

  /**
   * Compares this QuorumConfig instance with another for equality.
   * @param o The other QuorumConfig instance to compare with.
   * @returns True if both hold the same threshold and basis, otherwise false.
   */
  equals(o: QuorumConfig): boolean { return this.threshold === o.threshold && this.basis === o.basis; }
}
