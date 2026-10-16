/**
 * Closed set of examination standings. `OPEN → CONCLUDED` or
 * `OPEN → EXPIRED`; both terminals never answer again.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export const ExaminationStanding = {
  OPEN: 'OPEN',
  CONCLUDED: 'CONCLUDED',
  EXPIRED: 'EXPIRED',
} as const;
export type ExaminationStanding = (typeof ExaminationStanding)[keyof typeof ExaminationStanding];

export function parseExaminationStanding(v: string): ExaminationStanding {
  if (!(Object.values(ExaminationStanding) as string[]).includes(v))
    throw new Error(`invalid examination standing: ${v}`);
  return v as ExaminationStanding;
}
