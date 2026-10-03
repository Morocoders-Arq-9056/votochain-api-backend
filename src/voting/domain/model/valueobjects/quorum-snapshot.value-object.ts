/**
 * Quorum rule frozen at `open()` — written once, never changed.
 * The threshold comparison (`turnout >= threshold`) is owned here: it is a
 * one-line domain invariant with no technology to swap, so no outbound port
 * abstracts it.
 */
export class QuorumSnapshot {
  private constructor(
    public readonly threshold: number,
    public readonly basis: string,
  ) {
    if (!Number.isFinite(threshold) || threshold < 0) throw new Error('invalid quorum threshold');
    if (!basis?.trim()) throw new Error('invalid quorum basis');
  }

  static freeze(input: { threshold: number; basis: string }): QuorumSnapshot {
    return new QuorumSnapshot(input.threshold, input.basis);
  }

  verdictFor(turnout: number): boolean { return turnout >= this.threshold; }

  equals(o: QuorumSnapshot): boolean {
    return this.threshold === o.threshold && this.basis === o.basis;
  }
}
