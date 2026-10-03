import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";

/**
 * Event emitted when the executor reports a delivery failure.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryFailedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryFailed';
  readonly eventName = DeliveryFailedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly key: IdempotencyKey,
    public readonly reason: FailureReason,
  ) {}
}
