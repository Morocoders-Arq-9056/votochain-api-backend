/**
 * Signed vote envelope — Published Language across Voting, Wallet, Relay.
 * Wire: vote|<proposalId>|<voter>|<choiceCommitment>|<nonce>|<v>|<r>|<s>
 * - nonce: uuid string (VoteNonce), not numeric
 * - r/s: hex, with or without 0x, normalized to lowercase without prefix
 */
export class SignedVoteEnvelope {
  private constructor(
    public readonly proposalId: string,
    public readonly voter: string,
    public readonly choiceCommitment: string,
    public readonly nonce: string,
    public readonly v: number,
    public readonly r: string,
    public readonly s: string,
  ) {}

  private static normHex(h: string): string {
    return (h ?? '').replace(/^0x/i, '').toLowerCase();
  }

  static of(input: {
    proposalId: string;
    voter: string;
    choiceCommitment: string;
    nonce: string | number | bigint;
    v: number;
    r: string;
    s: string;
  }): SignedVoteEnvelope {
    if (!input.proposalId?.trim()) throw new Error('proposalId required');
    if (!/^0x[0-9a-fA-F]{40}$/.test(input.voter ?? '')) throw new Error('invalid voter address');
    if (!/^0x[0-9a-fA-F]{64}$/.test(input.choiceCommitment ?? '')) throw new Error('invalid choiceCommitment');
    const nonceStr = String(input.nonce ?? '').trim();
    if (!nonceStr) throw new Error('invalid nonce');
    if (input.v !== 27 && input.v !== 28) throw new Error('invalid v');
    const r = SignedVoteEnvelope.normHex(input.r);
    const s = SignedVoteEnvelope.normHex(input.s);
    if (!/^[0-9a-f]{64}$/.test(r) || !/^[0-9a-f]{64}$/.test(s)) throw new Error('invalid signature r/s');
    return new SignedVoteEnvelope(
      input.proposalId.trim(),
      input.voter.toLowerCase(),
      input.choiceCommitment.toLowerCase(),
      nonceStr,
      input.v,
      r,
      s,
    );
  }

  toWire(): string {
    return ['vote', this.proposalId, this.voter, this.choiceCommitment, this.nonce, String(this.v), this.r, this.s].join('|');
  }

  static fromWire(wire: string): SignedVoteEnvelope {
    const parts = (wire ?? '').split('|');
    if (parts.length !== 8 || parts[0] !== 'vote') throw new Error('invalid signed vote envelope');
    const [, proposalId, voter, choiceCommitment, nonce, v, r, s] = parts;
    return SignedVoteEnvelope.of({ proposalId, voter, choiceCommitment, nonce, v: Number(v), r, s });
  }
}
