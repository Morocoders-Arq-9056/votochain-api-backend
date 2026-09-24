import { QuorumConfig } from "./quorum-config.value-object.js";

/**
 * Value object representing the default participation rule of a community:
 * quorum threshold and basis plus majority rule. Each definition supersedes
 * the previous one; superseded versions remain history, never edited.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class VotingPolicy {
  /**
   * Creates a new VotingPolicy instance.
   * @param threshold How much participation is enough.
   * @param basis Enough of what (members, units, weighted).
   * @param majorityRule How a winner is recognized among the options.
   * @param supersedes The policy version this definition supersedes, if any.
   */
  private constructor(
    public readonly threshold: number,
    public readonly basis: string,
    public readonly majorityRule: string,
    public readonly supersedes: VotingPolicy | null,
  ) {}

  /**
   * Defines a new voting policy version, superseding the previous one.
   * @param input The threshold, basis, majority rule and superseded version.
   * @returns A new instance of VotingPolicy.
   */
  static define(input: { threshold: number; basis: string; majorityRule: string; supersedes: VotingPolicy | null }): VotingPolicy {
    const quorum = new QuorumConfig(input.threshold, input.basis);
    if (!input.majorityRule?.trim()) throw new Error('majorityRule required');
    return new VotingPolicy(quorum.threshold, quorum.basis, input.majorityRule, input.supersedes);
  }

  /**
   * Compares this VotingPolicy instance with another for equality.
   * @param o The other VotingPolicy instance to compare with.
   * @returns True if both hold the same rule, otherwise false.
   */
  equals(o: VotingPolicy): boolean {
    return this.threshold === o.threshold && this.basis === o.basis && this.majorityRule === o.majorityRule;
  }
}
