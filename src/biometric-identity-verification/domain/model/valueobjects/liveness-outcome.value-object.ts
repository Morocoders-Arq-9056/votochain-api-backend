/**
 * Closed set of liveness outcomes. Decided once, never revised.
 */
export const LivenessOutcome = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
} as const;
export type LivenessOutcome = (typeof LivenessOutcome)[keyof typeof LivenessOutcome];

export function parseLivenessOutcome(v: string): LivenessOutcome {
  if (!(Object.values(LivenessOutcome) as string[]).includes(v))
    throw new Error(`invalid liveness outcome: ${v}`);
  return v as LivenessOutcome;
}
