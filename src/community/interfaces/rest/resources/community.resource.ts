/**
 * Community response. Carries current state, policy head and administrators.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityResource {
  constructor(
    public readonly communityId: string,
    public readonly standing: string,
    public readonly name: string,
    public readonly domicile: string,
    public readonly contact: string,
    public readonly policy: { threshold: number; basis: string; majorityRule: string } | null,
    public readonly admins: { personId: string; entrustedAt: Date }[],
    public readonly acceptsMembers: boolean,
    public readonly acceptsProposals: boolean,
  ) {}
}
