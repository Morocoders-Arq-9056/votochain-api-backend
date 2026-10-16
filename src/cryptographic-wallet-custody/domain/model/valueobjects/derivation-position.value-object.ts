/**
 * Unique ordered position one signing capability occupies in the HD
 * derivation path. One position, one capability — uniqueness is enforced by
 * the storage UNIQUE constraint, with `existsPosition()` as the guard.
 */
export class DerivationPosition {
  private constructor(public readonly value: number) {}

  static of(v: number): DerivationPosition {
    if (!Number.isInteger(v) || v < 0) throw new Error('invalid derivation position');
    return new DerivationPosition(v);
  }

  equals(o: DerivationPosition): boolean { return this.value === o.value; }
}
