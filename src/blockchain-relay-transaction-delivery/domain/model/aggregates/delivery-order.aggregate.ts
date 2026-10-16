import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { SendingAttempt } from "../entities/sending-attempt.entity.js";
import { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import { DeliveryStanding } from "../valueobjects/delivery-standing.value-object.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";
import type { SendingOrderPosition } from "../valueobjects/sending-order-position.value-object.js";
import type { FeePolicy, RetryPolicy } from "../../services/delivery-policies.service.js";
import { IllegalDeliveryStateError } from "../../exceptions/illegal-delivery-state.error.js";
import { UnsignedContentRefusedError } from "../../exceptions/unsigned-content-refused.error.js";
import {
  AcceptedForDeliveryEvent,
  DeliveryAbandonedEvent,
  DeliveryConfirmedEvent,
  DeliveryFailedEvent,
  DeliveryRetriedEvent,
  OrderedForSendingEvent,
  SendingRecordedEvent,
} from "../events/delivery.events.js";

/**
 * Single aggregate of the Relay BC: one signed content's journey to the
 * ledger. Carries signed-only content, never signs, never tallies.
 *
 * ACCEPTED â†’ ORDERED â†’ SENT â†’ CONFIRMED (terminal) /
 * FAILED â†’ RETRIED â†’ ORDERED / â†’ ABANDONED (terminal).
 * `observeOutcome` is the sole decider after the ledger is observed.
 */
export class DeliveryOrder extends AggregateRoot {
  private constructor(
    private readonly _id: DeliveryOrderId,
    private readonly _contentRef: SignedContentRef,
    private readonly _payerRef: PayerRef,
    private readonly _orderPosition: SendingOrderPosition,
    private _standing: DeliveryStanding,
    private readonly _attempts: SendingAttempt[],
  ) { super(); }

  static accept(id: DeliveryOrderId, content: SignedContentRef, payer: PayerRef, pos: SendingOrderPosition, signedProof: string): DeliveryOrder {
    if (!signedProof?.trim()) throw new UnsignedContentRefusedError('content must arrive already signed');
    const o = new DeliveryOrder(id, content, payer, pos, DeliveryStanding.ACCEPTED, []);
    o.registerEvent(new AcceptedForDeliveryEvent(id, content, payer));
    return o;
  }

  static rehydrate(id: DeliveryOrderId, content: SignedContentRef, payer: PayerRef, pos: SendingOrderPosition, standing: DeliveryStanding, attempts: SendingAttempt[]): DeliveryOrder {
    return new DeliveryOrder(id, content, payer, pos, standing, [...attempts]);
  }

  order(): void {
    if (this._standing !== DeliveryStanding.ACCEPTED && this._standing !== DeliveryStanding.RETRIED) {
      throw new IllegalDeliveryStateError('order only from ACCEPTED/RETRIED');
    }
    this._standing = DeliveryStanding.ORDERED;
    this.registerEvent(new OrderedForSendingEvent(this._id, this._payerRef, this._orderPosition));
  }

  recordSending(): void {
    if (this._standing !== DeliveryStanding.ORDERED) throw new IllegalDeliveryStateError('send only from ORDERED');
    this._attempts.push(SendingAttempt.createSent(this._attempts.length + 1));
    this._standing = DeliveryStanding.SENT;
    this.registerEvent(new SendingRecordedEvent(this._id, this._attempts.length));
  }

  recordConfirmation(): void {
    if (this._standing !== DeliveryStanding.SENT) throw new IllegalDeliveryStateError('confirm only from SENT');
    this._standing = DeliveryStanding.CONFIRMED;
    this.registerEvent(new DeliveryConfirmedEvent(this._id, this._contentRef));
  }

  recordFailure(reason: FailureReason): void {
    if (this._standing !== DeliveryStanding.SENT) throw new IllegalDeliveryStateError('fail only from SENT');
    this._attempts.push(SendingAttempt.createFailed(this._attempts.length + 1, reason));
    this._standing = DeliveryStanding.FAILED;
    this.registerEvent(new DeliveryFailedEvent(this._id, reason));
  }

  retry(policy: RetryPolicy): void {
    if (this._standing === DeliveryStanding.CONFIRMED) throw new IllegalDeliveryStateError('RetryAfterConfirmationRefused');
    if (this._standing !== DeliveryStanding.FAILED) throw new IllegalDeliveryStateError('retry only from FAILED');
    if (!policy.shouldRetry(this._attempts.length, this.lastReason())) throw new IllegalDeliveryStateError('RetryLimitReached');
    this._standing = DeliveryStanding.RETRIED;
    this.registerEvent(new DeliveryRetriedEvent(this._id, this._attempts.length + 1));
  }

  abandon(reason: FailureReason): void {
    if (this._standing !== DeliveryStanding.FAILED) throw new IllegalDeliveryStateError('abandon only from FAILED');
    this._standing = DeliveryStanding.ABANDONED;
    this.registerEvent(new DeliveryAbandonedEvent(this._id, reason));
  }

  /**
   * Sole decider after observing the ledger: confirms, or fails and derives
   * to abandon/retry. The service translates the outcome to primitives and
   * delegates â€” it never decides here.
   */
  observeOutcome(confirmed: boolean, reason: FailureReason | null, retryable: boolean, retries: RetryPolicy, fees: FeePolicy): void {
    if (confirmed) { this.recordConfirmation(); return; }
    this.recordFailure(reason ?? FailureReason.of('LEDGER_REJECTED'));
    if (!fees.canAfford({ payerRef: this._payerRef })) { this.abandon(FailureReason.of('COST_EXHAUSTED')); return; }
    if (!retryable) { this.abandon(this.lastReason() ?? FailureReason.of('LEDGER_REJECTED')); return; }
    try { this.retry(retries); } catch { this.abandon(FailureReason.of('RETRY_LIMIT_REACHED')); }
  }

  answerDeliveryStanding(): { standing: DeliveryStanding; reason: string | null } {
    const last = [...this._attempts].reverse().find((a) => a.reason !== null);
    return { standing: this._standing, reason: last?.reason?.value ?? null };
  }

  private lastReason(): FailureReason | null {
    const last = [...this._attempts].reverse().find((a) => a.reason !== null);
    return last?.reason ?? null;
  }

  get id(): DeliveryOrderId { return this._id; }
  get contentRef(): SignedContentRef { return this._contentRef; }
  get payerRef(): PayerRef { return this._payerRef; }
  get orderPosition(): SendingOrderPosition { return this._orderPosition; }
  get standing(): DeliveryStanding { return this._standing; }
  get attempts(): SendingAttempt[] { return [...this._attempts]; }
}
