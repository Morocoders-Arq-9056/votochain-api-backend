import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";

/**
 * Event emitted when a failed dispatch retries, re-entering REQUESTED.
 * Re-instructs the send through the same in-module handler path.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryRetriedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryRetried';
  readonly eventName = DeliveryRetriedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly key: IdempotencyKey,
    public readonly attempt: number,
  ) {}
}
