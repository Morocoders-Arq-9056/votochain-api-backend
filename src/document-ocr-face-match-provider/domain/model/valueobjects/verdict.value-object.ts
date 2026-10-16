/**
 * Closed set of examination verdicts: `MATCH` (reads + holds),
 * `NO_MATCH` (reads, does not hold) or `UNREADABLE` (cannot judge).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export const Verdict = {
  MATCH: 'MATCH',
  NO_MATCH: 'NO_MATCH',
  UNREADABLE: 'UNREADABLE',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export function parseVerdict(v: string): Verdict {
  if (!(Object.values(Verdict) as string[]).includes(v))
    throw new Error(`invalid verdict: ${v}`);
  return v as Verdict;
}
