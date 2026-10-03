/**
 * Value object carrying one identity-history entry for scrutiny, in order:
 * what happened and when. Derived read model — no invariants, never mutated.
 *
 * Sprint-01 has no event store, so queries resolve `[]`; the shape stays
 * stable for the later persistence-backed implementation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class UserHistoryEntry {
  constructor(
    public readonly eventName: string,
    public readonly occurredAt: Date,
  ) {}
}
