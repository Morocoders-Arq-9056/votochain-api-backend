import { Choice } from "./choice.value-object.js";

/**
 * Tally result: per-choice counts, turnout, and the quorum verdict against
 * the snapshot frozen at open(). Counts stay keyed by the choice value
 * string: `Map` compares object keys by reference, so a `Choice` key would
 * miss on any equal-but-not-identical instance — the typed boundary is
 * `countFor(choice: Choice)`, which reads through `choice.value`. The map
 * itself never escapes: reads go through `countFor()`/`toRecord()`, so no
 * caller can mutate tally state post-construction.
 */
export class Tally {
  private constructor(
    private readonly _counts: Map<string, number>,
    public readonly turnout: number,
    public readonly quorumMet: boolean,
  ) {}

  static compute(input: { counts: ReadonlyMap<string, number>; turnout: number; quorumMet: boolean }): Tally {
    if (!Number.isInteger(input.turnout) || input.turnout < 0) throw new Error('invalid turnout');
    return new Tally(new Map(input.counts), input.turnout, input.quorumMet);
  }

  countFor(choice: Choice): number { return this._counts.get(choice.value) ?? 0; }

  toRecord(): Record<string, number> { return Object.fromEntries(this._counts); }

  equals(o: Tally): boolean {
    if (this.turnout !== o.turnout || this.quorumMet !== o.quorumMet) return false;
    if (this._counts.size !== o._counts.size) return false;
    for (const [choice, count] of this._counts) {
      if (o._counts.get(choice) !== count) return false;
    }
    return true;
  }
}
