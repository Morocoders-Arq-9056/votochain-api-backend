import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Query returning the ACTIVE memberships of a community (the roster).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetRosterByCommunityQuery {
  /**
   * Creates the query.
   * @param communityId Community the roster belongs to.
   */
  constructor(public readonly communityId: CommunityId) {
    if (!communityId) throw new Error('communityId required');
  }
}
