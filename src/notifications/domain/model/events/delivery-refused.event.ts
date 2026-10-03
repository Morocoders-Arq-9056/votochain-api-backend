import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";
import { RefusalReason } from "../valueobjects/refusal-reason.value-object.js";

/**
 * Event emitted when a delivery intent is refused without sending.
 *
 * Refusals persist as REFUSED history, never silent drops.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryRefusedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryRefused';
  readonly eventName = DeliveryRefusedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly key: IdempotencyKey,
    public readonly reason: RefusalReason,
  ) {}
}
