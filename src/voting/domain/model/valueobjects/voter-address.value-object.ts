/**
 * Ethereum address of a voter. `of()` validates `0x + 40 hex`, stores
 * lowercase, and `equals()` compares exactly — the recovered signer must
 * equal the declared voter (== ecrecover).
 */
export class VoterAddress {
  private constructor(public readonly value: string) {}

  static of(v: string): VoterAddress {
    if (!/^0x[0-9a-fA-F]{40}$/.test(v ?? '')) throw new Error(`invalid voter address: ${v}`);
    return new VoterAddress(v.toLowerCase());
  }

  equals(o: VoterAddress): boolean { return this.value === o.value; }
}
