/**
 * Value object representing the standing of a session.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export const SessionStanding = { CLOSED: 'SESSION_CLOSED', OPEN: 'SESSION_OPEN' } as const;
export type SessionStanding = typeof SessionStanding[keyof typeof SessionStanding];

/**
 * Parses a string value into a SessionStanding.
 * @param v The string value to parse.
 * @returns The corresponding SessionStanding if valid.
 * @throws An error if the provided value is not a valid SessionStanding.
 */
export function parseSessionStanding(v: string): SessionStanding {
  if (!(Object.values(SessionStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as SessionStanding;
}