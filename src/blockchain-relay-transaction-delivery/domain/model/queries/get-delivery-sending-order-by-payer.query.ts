import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";

export class GetDeliverySendingOrderByPayerQuery {
  constructor(public readonly payerRef: PayerRef) { if (!payerRef) throw new Error('payerRef required'); }
}
