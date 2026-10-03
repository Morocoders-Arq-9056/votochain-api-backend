import { randomUUID } from "node:crypto";

/**
 * Fresh anti-replay nonce, one per authorization window.
 */
export class VoteNonce {
  private constructor(public readonly value: string) {}

  static fresh(): VoteNonce { return new VoteNonce(randomUUID()); }

  static of(v: string): VoteNonce {
    if (!v?.trim()) throw new Error('invalid vote nonce');
    return new VoteNonce(v);
  }

  equals(o: VoteNonce): boolean { return this.value === o.value; }
}
