/** Closed set of attempt standings. Liveness first; verdict frozen. */
export const AttemptStanding = {
  CHALLENGE_OPEN: 'CHALLENGE_OPEN',
  LIVENESS_PASSED: 'LIVENESS_PASSED',
  LIVENESS_FAILED: 'LIVENESS_FAILED',
  COMPARISON_REQUESTED: 'COMPARISON_REQUESTED',
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  EXPIRED: 'EXPIRED',
} as const;
export type AttemptStanding = (typeof AttemptStanding)[keyof typeof AttemptStanding];

export function parseAttemptStanding(v: string): AttemptStanding {
  if (!(Object.values(AttemptStanding) as string[]).includes(v))
    throw new Error(`invalid attempt standing: ${v}`);
  return v as AttemptStanding;
}
