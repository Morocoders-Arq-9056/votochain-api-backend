import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import type { FailureReason } from "../valueobjects/failure-reason.value-object.js";

function stamped() { return new Date(); }

export class DeliveryAbandonedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryAbandoned';
  readonly eventName = DeliveryAbandonedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly reason: FailureReason) {}
}
