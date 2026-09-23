/**
 * Value object for why a challenge ended without confirmation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const InvalidationReason = {
  ATTEMPTS_EXHAUSTED: 'ATTEMPTS_EXHAUSTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type InvalidationReason = typeof InvalidationReason[keyof typeof InvalidationReason];

/**
 * Parses a string value into an InvalidationReason.
 * @param v The string value to parse.
 * @returns The corresponding InvalidationReason if valid.
 * @throws An error if the provided value is not a valid InvalidationReason.
 */
export function parseInvalidationReason(v: string): InvalidationReason {
  if (!(Object.values(InvalidationReason) as string[]).includes(v)) throw new Error(`invalid invalidation reason: ${v}`);
  return v as InvalidationReason;
}

export function attemptsExhausted(): InvalidationReason { return InvalidationReason.ATTEMPTS_EXHAUSTED; }
export function superseded(): InvalidationReason { return InvalidationReason.SUPERSEDED; }