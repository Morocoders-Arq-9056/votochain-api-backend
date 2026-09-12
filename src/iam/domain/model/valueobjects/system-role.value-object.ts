/**
 * Value object that represents a system role.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export const SystemRole = { ADMIN: 'ADMIN', USER: 'USER' } as const;
export type SystemRole = typeof SystemRole[keyof typeof SystemRole];

/**
 * Parses a string value into a SystemRole.
 *
 * @param v The string value to parse.
 * @returns The corresponding SystemRole if valid.
 */
export function parseSystemRole(v: string): SystemRole {
  if (!(Object.values(SystemRole) as string[]).includes(v)) throw new Error(`invalid system role: ${v}`);
  return v as SystemRole;
}