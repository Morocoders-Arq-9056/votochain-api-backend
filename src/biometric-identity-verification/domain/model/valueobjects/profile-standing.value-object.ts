/** Closed set of profile standings. `REVOKED` is terminal. */
export const ProfileStanding = {
  ENROLLED: 'ENROLLED',
  REVOKED: 'REVOKED',
} as const;
export type ProfileStanding = (typeof ProfileStanding)[keyof typeof ProfileStanding];

export function parseProfileStanding(v: string): ProfileStanding {
  if (!(Object.values(ProfileStanding) as string[]).includes(v))
    throw new Error(`invalid profile standing: ${v}`);
  return v as ProfileStanding;
}
