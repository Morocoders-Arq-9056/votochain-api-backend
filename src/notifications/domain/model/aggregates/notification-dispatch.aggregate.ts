import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { AlreadyConfirmedError } from "../../exceptions/already-confirmed.error.js";
import { ContactNotAllowedError } from "../../exceptions/contact-not-allowed.error.js";
import { DuplicateIntentError } from "../../exceptions/duplicate-intent.error.js";
import { NoSendInstructedError } from "../../exceptions/no-send-instructed.error.js";
import { RetryNotAllowedError } from "../../exceptions/retry-not-allowed.error.js";
import { DeliveryConfirmedEvent } from "../events/delivery-confirmed.event.js";
import { DeliveryFailedEvent } from "../events/delivery-failed.event.js";
import { DeliveryRequestedEvent } from "../events/delivery-requested.event.js";
import { DeliveryRefusedEvent } from "../events/delivery-refused.event.js";
import { DeliveryRetriedEvent } from "../events/delivery-retried.event.js";
import { DeliveryAddress } from "../valueobjects/delivery-address.value-object.js";
import type { DeliveryAttempt } from "../valueobjects/delivery-attempt.value-object.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { DispatchStanding } from "../valueobjects/dispatch-standing.value-object.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";
import { RefusalReason } from "../valueobjects/refusal-reason.value-object.js";
import { ResolvedTemplate } from "../valueobjects/resolved-template.value-object.js";

/**
 * Behavioral contract of a dispatchable delivery: outcomes observed back
 * from the executor after the send was instructed outside.
 */
export interface Dispatchable {
  /** Marks a REQUESTED dispatch delivered. */
  confirmDelivered(): void;
  /** Marks a REQUESTED dispatch failed with the observed cause. */
  recordDeliveryFailure(reason: FailureReason): void;
  /** Re-enters a FAILED dispatch as REQUESTED, appending history. */
  requestRetry(): void;
}

/**
 * Aggregate root judging the delivery standing of one delivery intent.
 *
 * Single consistency boundary for the standing and its append-only outcome
 * history. Email-only; retries append on the same dispatch. The aggregate
 * never sends: requesting delivery only records the intent and raises
 * `DeliveryRequestedEvent`, whose in-module handler instructs the executor
 * outside the boundary. Outcomes (confirm/fail) arrive back via webhooks.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class NotificationDispatch extends AggregateRoot implements Dispatchable {

  /**
   * Creates the aggregate; use {@link NotificationDispatch.requestDelivery} for
   * new intents, {@link NotificationDispatch.refuse} for refused ones, or
   * {@link NotificationDispatch.rehydrate} to rebuild stored state without events.
   */
  private constructor(
    private readonly _id: DispatchId,
    private readonly _key: IdempotencyKey,
    private readonly _address: DeliveryAddress,
    private readonly _template: ResolvedTemplate,
    private readonly _reason: string,
    private _standing: DispatchStanding,
    private readonly _history: DeliveryAttempt[],
    private _refusal: RefusalReason | null,
  ) { super(); }

  /**
   * Requests delivery of a new intent. Always REQUESTED; raises DeliveryRequestedEvent.
   * @param p Carries id, idempotency key, address, resolved template and reason.
   */
  static requestDelivery(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: string }): NotificationDispatch {
    const d = new NotificationDispatch(p.id, p.key, p.address, p.template, p.reason, DispatchStanding.REQUESTED, [{ at: new Date(), outcome: 'REQUESTED' }], null);
    d.registerEvent(new DeliveryRequestedEvent(d._id, d._key, d._address, d._template, d._reason));
    return d;
  }

  /**
   * Records a refused intent that never sent. Always REFUSED; raises DeliveryRefusedEvent.
   * @param p Carries id, key, address, template and the refusal cause.
   */
  static refuse(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: RefusalReason }): NotificationDispatch {
    const d = new NotificationDispatch(p.id, p.key, p.address, p.template, '', DispatchStanding.REFUSED, [{ at: new Date(), outcome: 'REFUSED', detail: p.reason.value }], p.reason);
    d.registerEvent(new DeliveryRefusedEvent(d._id, d._key, p.reason));
    return d;
  }

  /**
   * Rebuilds a stored dispatch without raising events or assuming standing.
   */
  static rehydrate(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: string; standing: DispatchStanding; history: DeliveryAttempt[]; refusal: RefusalReason | null }): NotificationDispatch {
    return new NotificationDispatch(p.id, p.key, p.address, p.template, p.reason, p.standing, [...p.history], p.refusal);
  }

  /**
   * Centralizes construction of the REFUSED dispatch for the DUPLICATE /
   * CONTACT_NOT_ALLOWED branches so the literal is not duplicated in the service.
   * @param p Carries id, key, address, template and the refusal cause code.
   * @returns The refused dispatch plus the rejection to throw after persisting it.
   */
  static refuseAndThrow(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reasonCode: 'DUPLICATE' | 'CONTACT_NOT_ALLOWED' }): { dispatch: NotificationDispatch; error: Error } {
    const dispatch = NotificationDispatch.refuse({ id: p.id, key: p.key, address: p.address, template: p.template, reason: RefusalReason.of(p.reasonCode) });
    const error = p.reasonCode === 'DUPLICATE' ? new DuplicateIntentError('idempotency key already seen') : new ContactNotAllowedError('contact not allowed now');
    return { dispatch, error };
  }

  /**
   * Guard: outcome webhooks only land on a REQUESTED dispatch.
   * @param err The rejection to throw when the standing moved on.
   */
  private requireRequested(err: Error): void {
    if (this._standing !== DispatchStanding.REQUESTED) throw err;
  }

  /**
   * Appends an outcome to the history. Never edits past attempts.
   * Outcomes are standings by construction: every recorded outcome is one
   * of the closed DispatchStanding members.
   * @param outcome The outcome to record.
   * @param detail Optional detail (failure cause).
   */
  private appendOutcome(outcome: DispatchStanding, detail?: string): void {
    this._history.push({ at: new Date(), outcome, ...(detail ? { detail } : {}) });
  }

  /**
   * Marks a REQUESTED dispatch delivered. Raises DeliveryConfirmedEvent.
   */
  confirmDelivered(): void {
    this.requireRequested(new AlreadyConfirmedError('only a requested dispatch can be confirmed'));
    this._standing = DispatchStanding.CONFIRMED;
    this.appendOutcome('CONFIRMED');
    this.registerEvent(new DeliveryConfirmedEvent(this._id, this._key));
  }

  /**
   * Marks a REQUESTED dispatch failed with the executor-observed cause.
   * Raises DeliveryFailedEvent.
   * @param reason The observed failure cause.
   */
  recordDeliveryFailure(reason: FailureReason): void {
    this.requireRequested(new NoSendInstructedError('no send instructed for the current attempt'));
    this._standing = DispatchStanding.FAILED;
    this.appendOutcome('FAILED', reason.value);
    this.registerEvent(new DeliveryFailedEvent(this._id, this._key, reason));
  }

  /**
   * Re-enters a FAILED dispatch as REQUESTED, appending history on the same
   * dispatch. Raises DeliveryRetriedEvent, which re-instructs the send.
   */
  requestRetry(): void {
    if (this._standing !== DispatchStanding.FAILED) throw new RetryNotAllowedError('only a failed dispatch can retry');
    this._standing = DispatchStanding.REQUESTED;
    this.appendOutcome('REQUESTED');
    this.registerEvent(new DeliveryRetriedEvent(this._id, this._key, this._history.length));
  }

  /**
   * Answers the standing question: standing, attempt count and refusal cause.
   * Mutates nothing, produces no facts.
   */
  answerDeliveryStanding(): { standing: DispatchStanding; attempts: number; refusal: string | null } {
    return { standing: this._standing, attempts: this._history.length, refusal: this._refusal?.value ?? null };
  }

  get id(): DispatchId { return this._id; }
  get key(): IdempotencyKey { return this._key; }
  get address(): DeliveryAddress { return this._address; }
  get template(): ResolvedTemplate { return this._template; }
  get reason(): string { return this._reason; }
  get standing(): DispatchStanding { return this._standing; }
  get history(): DeliveryAttempt[] { return [...this._history]; }
  get refusal(): RefusalReason | null { return this._refusal; }
}
