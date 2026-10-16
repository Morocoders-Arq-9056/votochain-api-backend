import type { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { AttemptOutcome } from "../valueobjects/attempt-outcome.value-object.js";

/**
 * Internal entity of `DeliveryOrder`: one recorded try. Only buildable via
 * its create-methods; the root appends, never rewrites (append-only).
 */
export class SendingAttempt {
  private constructor(
    public readonly nro: number,
    public readonly outcome: AttemptOutcome,
    public readonly reason: FailureReason | null,
  ) {}

  static createSent(nro: number): SendingAttempt {
    if (!Number.isInteger(nro) || nro < 1) throw new Error('invalid attempt number');
    return new SendingAttempt(nro, AttemptOutcome.SENT, null);
  }

  static createFailed(nro: number, reason: FailureReason): SendingAttempt {
    if (!Number.isInteger(nro) || nro < 1) throw new Error('invalid attempt number');
    if (!reason) throw new Error('failure reason required');
    return new SendingAttempt(nro, AttemptOutcome.FAILED, reason);
  }
}
