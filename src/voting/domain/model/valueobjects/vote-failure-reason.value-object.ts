export const VOTE_FAILURE_REASONS = [
  'LEDGER_REJECTED',
  'COST_EXHAUSTED',
  'RETRY_LIMIT_REACHED',
  'ORDER_SUPERSEDED',
  'RELAY_UNAVAILABLE',
] as const;
export type VoteFailureReasonValue = (typeof VOTE_FAILURE_REASONS)[number];

/**
 * Closed set of vote-delivery failure reasons (Voting's own vocabulary, R6
 * Separate Ways: never imports Relay's `FailureReason`). `RELAY_UNAVAILABLE`
 * covers the transport fallback when no ledger standing answers.
 */
export class VoteFailureReason {
  private constructor(public readonly value: VoteFailureReasonValue) {}

  static of(v: string): VoteFailureReason {
    if (!(VOTE_FAILURE_REASONS as readonly string[]).includes(v)) throw new Error(`invalid vote failure reason: ${v}`);
    return new VoteFailureReason(v as VoteFailureReasonValue);
  }

  /** Parses known reasons; unknown transport strings degrade to LEDGER_REJECTED. */
  static fromUnknown(v: string | null | undefined): VoteFailureReason {
    try {
      return VoteFailureReason.of(v ?? 'LEDGER_REJECTED');
    } catch {
      return VoteFailureReason.of('LEDGER_REJECTED');
    }
  }

  equals(o: VoteFailureReason): boolean { return this.value === o.value; }
  toString(): string { return this.value; }
}

export function parseVoteFailureReason(v: string): VoteFailureReason {
  return VoteFailureReason.of(v);
}
