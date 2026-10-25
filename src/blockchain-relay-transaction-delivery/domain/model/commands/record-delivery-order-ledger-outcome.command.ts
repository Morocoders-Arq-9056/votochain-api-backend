import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";

export class RecordDeliveryOrderLedgerOutcomeCommand {
  constructor(
    public readonly orderId: DeliveryOrderId,
    public readonly confirmed: boolean,
    public readonly reason: string | null,
    public readonly retryable: boolean,
  ) { if (!orderId) throw new Error('orderId required'); }
}
