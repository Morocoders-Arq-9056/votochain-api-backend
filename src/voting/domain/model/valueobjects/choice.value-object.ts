/**
 * A single selectable option on a ballot. Free-form label; validity is judged
 * against {@link BallotOptions} by the owning proposal, never here.
 */
export class Choice {
  private constructor(public readonly value: string) {}

  static of(v: string): Choice {
    if (!v?.trim()) throw new Error('invalid choice');
    return new Choice(v);
  }

  equals(o: Choice): boolean { return this.value === o.value; }
}
