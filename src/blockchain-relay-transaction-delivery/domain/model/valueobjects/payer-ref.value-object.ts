/**
 * Opaque payer capability paying for sending. Never the voter's signing
 * capability (R6 Separate Ways: signer/payer split, never mixed).
 */
export class PayerRef {
  private constructor(public readonly value: string) {}

  static of(v: string): PayerRef {
    if (!v?.trim()) throw new Error('invalid payer ref');
    return new PayerRef(v);
  }

  equals(o: PayerRef): boolean { return this.value === o.value; }
}
