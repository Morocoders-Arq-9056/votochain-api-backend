/**
 * Value object for the classic-login local secret (plain password at the
 * domain boundary, never persisted). The hash lives in `User.secretHash`;
 * this type only judges the acceptance policy for new secrets.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-11-10
 */
export class LocalSecret {
  private constructor(public readonly value: string) {}

  /**
   * Parses a candidate secret under the acceptance policy.
   * @param v Raw candidate secret.
   */
  static parse(v: string): LocalSecret {
    if (typeof v !== 'string' || v.length < 10 || v.length > 16)
      throw new Error('secret must be 10..16 chars');
    if (!/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/\d/.test(v))
      throw new Error('secret must mix lower, upper and digit');
    if (/^\s|\s$/.test(v)) throw new Error('secret must not start/end with space');
    return new LocalSecret(v);
  }
}
