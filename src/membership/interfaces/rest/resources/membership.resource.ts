/**
 * Membership response. Carries the pair, standing, role, unit and the last
 * frozen judgment reference.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipResource {
  constructor(
    public readonly membershipId: string,
    public readonly personId: string,
    public readonly communityId: string,
    public readonly status: string,
    public readonly role: string,
    public readonly unitCode: string | null,
    public readonly lastVerdict: string | null,
    public readonly lastSnapshotRef: string | null,
  ) {}
}
