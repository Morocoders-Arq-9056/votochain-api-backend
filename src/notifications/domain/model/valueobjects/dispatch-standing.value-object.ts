/**
 * Closed set of dispatch standings.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const DispatchStanding = { REQUESTED: 'REQUESTED', REFUSED: 'REFUSED', CONFIRMED: 'CONFIRMED', FAILED: 'FAILED' } as const;
export type DispatchStanding = (typeof DispatchStanding)[keyof typeof DispatchStanding];

/**
 * Parses a string value into a DispatchStanding.
 * @param v The string value to parse.
 * @returns The corresponding DispatchStanding when valid.
 * @throws An error when the value is not a known standing.
 */
export function parseDispatchStanding(v: string): DispatchStanding {
  if (!(Object.values(DispatchStanding) as string[]).includes(v)) throw new Error(`invalid dispatch standing: ${v}`);
  return v as DispatchStanding;
}
