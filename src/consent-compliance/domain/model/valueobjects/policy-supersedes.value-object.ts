/**
 * Reference to the retention policy superseded by a new definition.
 * Wraps the former `supersedes: string | null` primitive so commands and
 * events carry a value object instead of a raw string.
 */
export class PolicySupersedes {
  private constructor(public readonly value: string) {}

  static of(v: string): PolicySupersedes {
    if (!v?.trim()) throw new Error('supersedes required');
    return new PolicySupersedes(v);
  }

  equals(o: PolicySupersedes): boolean { return this.value === o.value; }
  toString(): string { return this.value; }
}
