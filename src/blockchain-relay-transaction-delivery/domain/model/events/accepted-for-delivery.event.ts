import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";

function stamped() { return new Date(); }

export class AcceptedForDeliveryEvent implements DomainEvent {
  static readonly eventName = 'AcceptedForDelivery';
  readonly eventName = AcceptedForDeliveryEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly contentRef: SignedContentRef, public readonly payerRef: PayerRef) {}
}
