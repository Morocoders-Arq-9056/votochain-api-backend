/**
 * Value object representing the standing of a challenge in the verification domain.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export const ChallengeStanding = { OPEN: 'OPEN', CONFIRMED: 'CONFIRMED', INVALIDATED: 'INVALIDATED', EXPIRED: 'EXPIRED' } as const;

/**
 * Parses a string value into a ChallengeStanding.
 * 
 * @param v The string value to parse.
 * @returns The corresponding ChallengeStanding if valid.
 * @throws An error if the provided value is not a valid ChallengeStanding.
 */
export type ChallengeStanding = typeof ChallengeStanding[keyof typeof ChallengeStanding];

/**
 * Parses a string value into a ChallengeStanding.
 * @param v The string value to parse.
 * @returns The corresponding ChallengeStanding if valid.
 * @throws An error if the provided value is not a valid ChallengeStanding.
 */
export function parseChallengeStanding(v: string): ChallengeStanding {
  if (!(Object.values(ChallengeStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as ChallengeStanding;
}