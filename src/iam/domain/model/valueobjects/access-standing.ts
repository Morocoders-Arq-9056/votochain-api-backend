/**
 * Value object representing the standing of an access.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export const AccessStanding = { REGISTERED: 'REGISTERED', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;
export type AccessStanding = typeof AccessStanding[keyof typeof AccessStanding];

/**
 * Parses a string value into a AccessStanding.
 * @param v The string value to parse.
 * @returns The corresponding AccessStanding if valid.
 * @throws An error if the provided value is not a valid AccessStanding.
 */
export function parseAccessStanding(v: string): AccessStanding {
  if (!(Object.values(AccessStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as AccessStanding;
}