import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";
import type { DeliveryOrderId } from "../valueobjects/delivery-order-id.value-object.js";

export class AcceptDeliveryOrderCommand {
  constructor(
    public readonly contentRef: SignedContentRef,
    public readonly payerRef: PayerRef,
    public readonly signedProof: string,
  ) { if (!contentRef || !payerRef || !signedProof?.trim()) throw new Error('content+payer+proof required'); }
}

export class DeliverOrderCommand {
  constructor(public readonly orderId: DeliveryOrderId) { if (!orderId) throw new Error('orderId required'); }
}

export class RecordDeliveryOrderLedgerOutcomeCommand {
  constructor(
    public readonly orderId: DeliveryOrderId,
    public readonly confirmed: boolean,
    public readonly reason: string | null,
    public readonly retryable: boolean,
  ) { if (!orderId) throw new Error('orderId required'); }
}
