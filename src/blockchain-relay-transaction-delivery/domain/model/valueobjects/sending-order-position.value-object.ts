/**
 * Sequential per-payer sending position. Dense, `>= 0`. No overtaking:
 * `UNIQUE(payer_ref, order_position)` enforces it structurally.
 */
export class SendingOrderPosition {
  private constructor(public readonly value: number) {}

  static of(v: number): SendingOrderPosition {
    if (!Number.isInteger(v) || v < 0) throw new Error('invalid sending order position');
    return new SendingOrderPosition(v);
  }

  equals(o: SendingOrderPosition): boolean { return this.value === o.value; }
}
