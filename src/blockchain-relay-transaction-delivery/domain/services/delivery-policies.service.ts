import type { FailureReason } from "../model/valueobjects/failure-reason.value-object.js";
import type { PayerRef } from "../model/valueobjects/payer-ref.value-object.js";

export const RETRY_POLICY = Symbol('RETRY_POLICY');

export interface RetryPolicy {
  shouldRetry(attempts: number, reason: FailureReason | null): boolean;
}

export const FEE_POLICY = Symbol('FEE_POLICY');

export interface FeePolicy {
  canAfford(order: { payerRef: PayerRef }): boolean;
}
