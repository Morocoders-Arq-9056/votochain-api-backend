import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";

export class GetDeliveryOrderStandingByIdQuery {
  constructor(public readonly orderId: DeliveryOrderId) { if (!orderId) throw new Error('orderId required'); }
}

export class GetDeliverySendingOrderByPayerQuery {
  constructor(public readonly payerRef: PayerRef) { if (!payerRef) throw new Error('payerRef required'); }
}

export class GetDeliveryAttemptHistoryByOrderQuery {
  constructor(public readonly orderId: DeliveryOrderId) { if (!orderId) throw new Error('orderId required'); }
}
