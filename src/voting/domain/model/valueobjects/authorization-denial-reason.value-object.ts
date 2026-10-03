/**
 * Closed set of authorization denial reasons.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const AuthorizationDenialReason = { NOT_ELIGIBLE: 'NOT_ELIGIBLE', NOT_VERIFIED: 'NOT_VERIFIED' } as const;
export type AuthorizationDenialReason = (typeof AuthorizationDenialReason)[keyof typeof AuthorizationDenialReason];

/**
 * Parses a string value into an AuthorizationDenialReason.
 * @param v The string value to parse.
 * @returns The corresponding denial reason when valid.
 * @throws An error when the value is not a known reason.
 */
export function parseAuthorizationDenialReason(v: string): AuthorizationDenialReason {
  if (!(Object.values(AuthorizationDenialReason) as string[]).includes(v)) throw new Error(`invalid denial reason: ${v}`);
  return v as AuthorizationDenialReason;
}
