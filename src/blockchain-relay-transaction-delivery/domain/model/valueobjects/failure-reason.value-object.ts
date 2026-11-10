export const FAILURE_REASONS = ['LEDGER_REJECTED', 'COST_EXHAUSTED', 'RETRY_LIMIT_REACHED', 'ORDER_SUPERSEDED', 'MINING_TIMEOUT'] as const;
export type FailureReasonValue = (typeof FAILURE_REASONS)[number];

/**
 * Typed failure reason. Only `LEDGER_REJECTED` and `ORDER_SUPERSEDED` are
 * retryable by nature; cost exhaustion and retry-limit are terminal signals
 * (the retry/abandon decision itself lives in `DeliveryOrder.observeOutcome`).
 */
export class FailureReason {
  private constructor(public readonly value: FailureReasonValue) {}

  static of(v: string): FailureReason {
    if (!(FAILURE_REASONS as readonly string[]).includes(v)) throw new Error(`invalid failure reason: ${v}`);
    return new FailureReason(v as FailureReasonValue);
  }

  isRetryable(): boolean {
    return this.value === 'LEDGER_REJECTED' || this.value === 'ORDER_SUPERSEDED' || this.value === 'MINING_TIMEOUT';
  }

  equals(o: FailureReason): boolean { return this.value === o.value; }
}

export function parseFailureReason(v: string): FailureReason {
  return FailureReason.of(v);
}
