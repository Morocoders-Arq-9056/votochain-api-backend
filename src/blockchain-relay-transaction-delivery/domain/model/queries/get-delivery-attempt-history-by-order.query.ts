import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";

export class GetDeliveryAttemptHistoryByOrderQuery {
  constructor(public readonly orderId: DeliveryOrderId) { if (!orderId) throw new Error('orderId required'); }
}
