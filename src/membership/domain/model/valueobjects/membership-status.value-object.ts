/**
 * Closed set of membership standings. Only ACTIVE counts toward the roster;
 * TERMINATED is terminal.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const MembershipStatus = {
  REQUESTED: 'REQUESTED',
  ACTIVE: 'ACTIVE',
  DELINQUENT: 'DELINQUENT',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type MembershipStatus = typeof MembershipStatus[keyof typeof MembershipStatus];

/**
 * Parses an untrusted string into a MembershipStatus. Never `as`: a corrupt
 * row must throw where the corruption happened.
 * @param v Raw status string.
 */
export function parseMembershipStatus(v: string): MembershipStatus {
  if (!(Object.values(MembershipStatus) as string[]).includes(v))
    throw new Error(`invalid membership status: ${v}`);
  return v as MembershipStatus;
}
