/**
 * Closed set of community roles a member may hold.
 */
export const CommunityRoleKind = {
  PRESIDENT: 'PRESIDENT',
  BOARD_MEMBER: 'BOARD_MEMBER',
  OWNER: 'OWNER',
} as const;
export type CommunityRoleKind = typeof CommunityRoleKind[keyof typeof CommunityRoleKind];

/**
 * Role held by a member inside a community. New memberships start as OWNER;
 * elevation requires an ACTIVE standing (judged by the aggregate).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class CommunityRole {
  /** Creates the role; use {@link CommunityRole.of} or {@link CommunityRole.owner}. */
  private constructor(public readonly kind: CommunityRoleKind) {}

  /**
   * Default role for newly registered memberships.
   * @returns The OWNER role.
   */
  static owner(): CommunityRole { return new CommunityRole(CommunityRoleKind.OWNER); }

  /**
   * Builds a role from a known kind.
   * @param kind Role kind.
   */
  static of(kind: CommunityRoleKind): CommunityRole { return new CommunityRole(kind); }

  /**
   * Value comparison.
   * @param o Other role.
   */
  equals(o: CommunityRole): boolean { return this.kind === o.kind; }
}

/**
 * Parses an untrusted string into a CommunityRole. Never `as`: a corrupt
 * row must throw where the corruption happened.
 * @param value Raw role string.
 */
export function parseCommunityRole(value: string): CommunityRole {
  if (!(Object.values(CommunityRoleKind) as string[]).includes(value))
    throw new Error(`invalid community role: ${value}`);
  return CommunityRole.of(value as CommunityRoleKind);
}
