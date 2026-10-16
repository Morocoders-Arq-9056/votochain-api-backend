export const AttemptOutcome = { SENT: 'SENT', FAILED: 'FAILED' } as const;
export type AttemptOutcome = (typeof AttemptOutcome)[keyof typeof AttemptOutcome];

export function parseAttemptOutcome(v: string): AttemptOutcome {
  if (!(Object.values(AttemptOutcome) as string[]).includes(v)) throw new Error(`invalid attempt outcome: ${v}`);
  return v as AttemptOutcome;
}
