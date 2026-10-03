/**
 * Identity reference to the Community context. Voting never owns community
 * state; it only carries the identifier and freezes policy copies.
 */
export class CommunityId {
  private constructor(public readonly value: string) {}

  static of(v: string): CommunityId {
    if (!v?.trim()) throw new Error('invalid community id');
    return new CommunityId(v);
  }

  equals(o: CommunityId): boolean { return this.value === o.value; }
}
