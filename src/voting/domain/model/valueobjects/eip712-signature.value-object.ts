/**
 * EIP-712 signature over (proposal, voter, choice, nonce): `{ v, r, s }`.
 * `from()` accepts the wallet's raw string form `v:r:s`.
 */
export class EIP712Signature {
  private constructor(
    public readonly v: number,
    public readonly r: string,
    public readonly s: string,
  ) {}

  static create(input: { v: number; r: string; s: string }): EIP712Signature {
    if (!Number.isInteger(input.v)) throw new Error('invalid signature v');
    if (!input.r?.trim() || !input.s?.trim()) throw new Error('invalid signature r/s');
    return new EIP712Signature(input.v, input.r, input.s);
  }

  static from(raw: string): EIP712Signature {
    const parts = (raw ?? '').split(':');
    if (parts.length !== 3) throw new Error('invalid signature encoding');
    const v = Number(parts[0]);
    return EIP712Signature.create({ v, r: parts[1], s: parts[2] });
  }

  toString(): string { return `${this.v}:${this.r}:${this.s}`; }

  equals(o: EIP712Signature): boolean { return this.v === o.v && this.r === o.r && this.s === o.s; }
}
