/**
 * Closed set of refusal causes for a delivery intent that never sent.
 *
 * DUPLICATE marks a repeated idempotency key; CONTACT_NOT_ALLOWED marks a
 * consent-gate refusal. Refusals persist as REFUSED history, never silent drops.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const RefusalReasonCode = { DUPLICATE: 'DUPLICATE', CONTACT_NOT_ALLOWED: 'CONTACT_NOT_ALLOWED' } as const;
export type RefusalReasonCode = (typeof RefusalReasonCode)[keyof typeof RefusalReasonCode];

/**
 * Parses a string value into a RefusalReasonCode.
 * @param v The string value to parse.
 * @returns The corresponding RefusalReasonCode when valid.
 * @throws An error when the value is not a known refusal cause.
 */
export function parseRefusalReason(v: string): RefusalReasonCode {
  if (!(Object.values(RefusalReasonCode) as string[]).includes(v)) throw new Error(`invalid refusal reason: ${v}`);
  return v as RefusalReasonCode;
}

/**
 * Value object naming why a delivery intent was refused without sending.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RefusalReason {

  /**
   * Creates a new RefusalReason instance, validating the cause.
   *
   * @param value The refusal cause: DUPLICATE | CONTACT_NOT_ALLOWED.
   */
  private constructor(public readonly value: RefusalReasonCode) {
    this.value = parseRefusalReason(value);
  }

  /**
   * Creates a RefusalReason instance from a given string value.
   * @param v The refusal cause string.
   * @returns A new instance of RefusalReason.
   */
  static of(v: string): RefusalReason { return new RefusalReason(parseRefusalReason(v)); }

  /**
   * Compares the current RefusalReason instance with another one for equality.
   * @param o The other RefusalReason instance to compare with.
   * @returns True when both instances carry the same cause.
   */
  equals(o: RefusalReason): boolean { return this.value === o.value; }
}
