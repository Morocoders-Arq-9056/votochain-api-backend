import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Query returning the live membership for a pair.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetMembershipByPersonAndCommunityQuery {
  /**
   * Creates the query.
   * @param personId Person the membership belongs to.
   * @param communityId Community the membership belongs to.
   */
  constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
  ) {
    if (!personId) throw new Error('personId required');
    if (!communityId) throw new Error('communityId required');
  }
}
