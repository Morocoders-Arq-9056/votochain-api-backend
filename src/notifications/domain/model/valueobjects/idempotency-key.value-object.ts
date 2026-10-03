/**
 * Value object carrying the requester-supplied idempotency key of a delivery intent.
 *
 * The key names the intent (who asked for what), never the dispatch: a repeated
 * key is refused as DUPLICATE and persisted as REFUSED history, never delivered twice.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class IdempotencyKey {

  /**
   * Creates a new IdempotencyKey instance.
   *
   * @param value The value of the idempotency key.
   */
  private constructor(public readonly value: string) {}

  /**
   * Creates an IdempotencyKey instance from a given string value.
   * @param v The string value to create the IdempotencyKey from.
   * @returns A new instance of IdempotencyKey with the provided value.
   */
  static of(v: string): IdempotencyKey { if (!v?.trim()) throw new Error('invalid idempotency key'); return new IdempotencyKey(v); }

  /**
   * Compares the current IdempotencyKey instance with another one for equality.
   * @param o The other IdempotencyKey instance to compare with.
   * @returns True when both instances carry the same value.
   */
  equals(o: IdempotencyKey): boolean { return this.value === o.value; }
}
