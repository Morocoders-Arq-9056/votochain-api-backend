import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import type { SendingOrderPosition } from "../valueobjects/sending-order-position.value-object.js";
import type { FailureReason } from "../valueobjects/failure-reason.value-object.js";

function stamped() { return new Date(); }

export class AcceptedForDeliveryEvent implements DomainEvent {
  static readonly eventName = 'AcceptedForDelivery';
  readonly eventName = AcceptedForDeliveryEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly contentRef: SignedContentRef, public readonly payerRef: PayerRef) {}
}

export class OrderedForSendingEvent implements DomainEvent {
  static readonly eventName = 'OrderedForSending';
  readonly eventName = OrderedForSendingEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly payerRef: PayerRef, public readonly position: SendingOrderPosition) {}
}

export class SendingRecordedEvent implements DomainEvent {
  static readonly eventName = 'SendingRecorded';
  readonly eventName = SendingRecordedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly attemptNo: number) {}
}

export class DeliveryConfirmedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryConfirmed';
  readonly eventName = DeliveryConfirmedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly contentRef: SignedContentRef) {}
}

export class DeliveryFailedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryFailed';
  readonly eventName = DeliveryFailedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly reason: FailureReason) {}
}

export class DeliveryRetriedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryRetried';
  readonly eventName = DeliveryRetriedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly nextAttemptNo: number) {}
}

export class DeliveryAbandonedEvent implements DomainEvent {
  static readonly eventName = 'DeliveryAbandoned';
  readonly eventName = DeliveryAbandonedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly orderId: DeliveryOrderId, public readonly reason: FailureReason) {}
}
