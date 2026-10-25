import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";

function stamped() { return new Date(); }

export class DeliveryConfirmedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryConfirmed';
  readonly eventName = DeliveryConfirmedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly contentRef: SignedContentRef) {}
}
