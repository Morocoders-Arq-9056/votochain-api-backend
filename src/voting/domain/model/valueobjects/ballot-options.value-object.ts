import { Choice } from "./choice.value-object.js";

/**
 * Frozen ballot owned by the proposal. Requires at least 2 options;
 * `contains()` is the validity gate for cast choices.
 */
export class BallotOptions {
  private constructor(private readonly _options: Choice[]) {}

  static of(values: string[]): BallotOptions {
    if (!values || values.length < 2) throw new Error('ballot needs >= 2 options');
    return new BallotOptions(values.map((v) => Choice.of(v)));
  }

  contains(choice: Choice): boolean { return this._options.some((o) => o.equals(choice)); }

  equals(o: BallotOptions): boolean {
    return this._options.length === o._options.length
      && this._options.every((option, index) => option.equals(o._options[index]));
  }

  get size(): number { return this._options.length; }

  get values(): string[] { return this._options.map((o) => o.value); }
}
