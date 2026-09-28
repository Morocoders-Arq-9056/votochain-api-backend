/**
 * Value object carrying one identity-history entry for scrutiny, in order:
 * what happened and when. Derived read model — no invariants, never mutated.
 *
 * Sprint-01 has no event store, so queries resolve `[]`; the shape stays
 * stable for the later persistence-backed implementation.
 */
export class UserHistoryEntry {
  constructor(
    public readonly eventName: string,
    public readonly occurredAt: Date,
  ) {}
}
