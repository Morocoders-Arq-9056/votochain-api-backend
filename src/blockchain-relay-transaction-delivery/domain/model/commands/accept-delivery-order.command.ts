import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import type { PayerRef } from "../valueobjects/payer-ref.value-object.js";

export class AcceptDeliveryOrderCommand {
  constructor(
    public readonly contentRef: SignedContentRef,
    public readonly payerRef: PayerRef,
    public readonly signedProof: string,
  ) { if (!contentRef || !payerRef || !signedProof?.trim()) throw new Error('content+payer+proof required'); }
}
