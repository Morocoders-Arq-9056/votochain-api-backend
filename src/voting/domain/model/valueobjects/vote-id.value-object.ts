import { randomUUID } from "node:crypto";

/**
 * Identity of a vote. Generated as `vote-<uuid>`.
 */
export class VoteId {
  private constructor(public readonly value: string) {}

  static generate(): VoteId { return new VoteId(`vote-${randomUUID()}`); }

  static of(v: string): VoteId {
    if (!v?.trim()) throw new Error('invalid vote id');
    return new VoteId(v);
  }

  equals(o: VoteId): boolean { return this.value === o.value; }
}
