/**
 * Community standing answer response.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityStandingResource {
  constructor(
    public readonly standing: string,
    public readonly acceptsMembers: boolean,
    public readonly acceptsProposals: boolean,
  ) {}
}
