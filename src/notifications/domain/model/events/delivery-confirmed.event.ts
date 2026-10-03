import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DispatchId } from "../valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";

/**
 * Event emitted when the executor confirms a dispatch as delivered.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DeliveryConfirmedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryConfirmed';
  readonly eventName = DeliveryConfirmedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly dispatchId: DispatchId,
    public readonly key: IdempotencyKey,
  ) {}
}
