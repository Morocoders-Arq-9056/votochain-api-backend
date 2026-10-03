import { VoteAuthorization } from "../model/aggregates/vote-authorization.aggregate.js";
import { GetAuthorizationByIdQuery } from "../model/queries/get-authorization-by-id.query.js";

/**
 * Domain port for VoteAuthorization reads. Controllers requery through this
 * port after a write; they never inject repositories directly.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const AUTHORIZATION_QUERY_SERVICE = Symbol('AUTHORIZATION_QUERY_SERVICE');

export interface VoteAuthorizationQueryService {
  getAuthorizationById(query: GetAuthorizationByIdQuery): Promise<VoteAuthorization | null>;
}
