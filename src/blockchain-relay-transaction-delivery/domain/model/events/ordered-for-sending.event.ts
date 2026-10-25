import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";
import type { SendingOrderPosition } from "../valueobjects/sending-order-position.value-object.js";

function stamped() { return new Date(); }

export class OrderedForSendingEvent implements DomainEvent {
  static readonly eventName = 'OrderedForSending';
  readonly eventName = OrderedForSendingEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly payerRef: PayerRef, public readonly position: SendingOrderPosition) {}
}
