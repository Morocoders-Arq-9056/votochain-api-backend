/**
 * Chain-observed transaction reference. Observed from the relay/chain, never
 * invented by this context.
 */
export class TransactionReference {
  private constructor(
    public readonly txHash: string,
    public readonly blockNumber: number | null,
  ) {
    if (!txHash?.trim()) throw new Error('invalid tx hash');
  }

  static of(input: { txHash: string; blockNumber?: number | null }): TransactionReference {
    return new TransactionReference(input.txHash, input.blockNumber ?? null);
  }

  equals(o: TransactionReference): boolean {
    return this.txHash === o.txHash && this.blockNumber === o.blockNumber;
  }
}
