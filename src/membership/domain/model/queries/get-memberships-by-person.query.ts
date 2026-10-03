import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Query returning the live memberships held by a person.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetMembershipsByPersonQuery {
  /**
   * Creates the query.
   * @param personId Person the memberships belong to.
   */
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
