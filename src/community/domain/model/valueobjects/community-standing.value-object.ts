/**
 * Value object representing the standing of a community.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export const CommunityStanding = { REGISTERED: 'REGISTERED', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', ARCHIVED: 'ARCHIVED' } as const;
export type CommunityStanding = typeof CommunityStanding[keyof typeof CommunityStanding];

/**
 * Parses a string value into a CommunityStanding.
 * @param v The string value to parse.
 * @returns The corresponding CommunityStanding if valid.
 * @throws An error if the provided value is not a valid CommunityStanding.
 */
export function parseCommunityStanding(v: string): CommunityStanding {
  if (!(Object.values(CommunityStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as CommunityStanding;
}
