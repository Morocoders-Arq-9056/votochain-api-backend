/**
 * Value object representing the reason for signing out.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export const SignOutReason = { ASKED: 'ASKED', SUPERSEDED: 'SUPERSEDED', PROOF_CHANGED: 'PROOF_CHANGED', SUSPENDED: 'SUSPENDED' } as const;
export type SignOutReason = typeof SignOutReason[keyof typeof SignOutReason];

/**
 * Parses a string value into a SignOutReason.
 *
 * @param v The string value to parse.
 * @returns The corresponding SignOutReason if valid.
 * @throws An error if the provided value is not a valid SignOutReason.
 */
export function parseSignOutReason(v: string): SignOutReason {
  if (!(Object.values(SignOutReason) as string[]).includes(v)) throw new Error(`invalid sign out reason: ${v}`);
  return v as SignOutReason;
}