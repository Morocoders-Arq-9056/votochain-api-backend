/**
 * Purpose value object
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export const Purpose = { LOGIN: 'login', EMAIL_VERIFICATION: 'email-verification', PASSWORD_RESET: 'password-reset' } as const;
export type Purpose = typeof Purpose[keyof typeof Purpose];

/**
 * Parses a string value into a Purpose.
 * @param v The string value to parse.
 * @returns The corresponding Purpose if valid.
 * @throws An error if the provided value is not a valid Purpose.
 */
export function parsePurpose(v: string): Purpose {
  if (!(Object.values(Purpose) as string[]).includes(v)) throw new Error(`invalid purpose: ${v}`);
  return v as Purpose;
}