/**
 * Closed set of verification failure reasons. Carries no comparison detail.
 */
export const FailureReason = {
  LIVENESS_NOT_OBSERVED: 'LIVENESS_NOT_OBSERVED',
  NO_MATCH: 'NO_MATCH',
  REFERENCE_ENDED: 'REFERENCE_ENDED',
  ATTEMPT_EXPIRED: 'ATTEMPT_EXPIRED',
  CONSENT_WITHDRAWN: 'CONSENT_WITHDRAWN',
} as const;
export type FailureReason = (typeof FailureReason)[keyof typeof FailureReason];

export function parseFailureReason(v: string): FailureReason {
  if (!(Object.values(FailureReason) as string[]).includes(v))
    throw new Error(`invalid failure reason: ${v}`);
  return v as FailureReason;
}
