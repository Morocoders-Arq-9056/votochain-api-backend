import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";

function stamped() { return new Date(); }

export class DeliveryRetriedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryRetried';
  readonly eventName = DeliveryRetriedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly nextAttemptNo: number) {}
}
