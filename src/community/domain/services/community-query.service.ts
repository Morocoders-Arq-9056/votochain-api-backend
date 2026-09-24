import { Community } from "../model/aggregates/community.aggregate.js";
import { GetAdministratorsByCommunityQuery } from "../model/queries/get-administrators-by-community.query.js";
import { GetCommunityByIdQuery } from "../model/queries/get-community-by-id.query.js";
import { GetStandingByCommunityQuery } from "../model/queries/get-standing-by-community.query.js";
import { GetVotingPolicyByCommunityQuery } from "../model/queries/get-voting-policy-by-community.query.js";
import { CommunityAdmin } from "../model/valueobjects/community-admin.value-object.js";
import { CommunityStandingAnswer } from "../model/valueobjects/community-standing-answer.value-object.js";
import { VotingPolicy } from "../model/valueobjects/voting-policy.value-object.js";

/**
 * Domain port for Community read use cases (CQRS query side).
 *
 * Queries judge current state and answer; they mutate nothing and
 * produce no facts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export interface CommunityQueryService {
  /**
   * Finds a community by identity.
   * @param query Carries communityId.
   * @returns A promise that resolves to the Community or null.
   */
  getCommunityById(query: GetCommunityByIdQuery): Promise<Community | null>;

  /**
   * Answers the current voting policy once defined.
   * @param query Carries communityId.
   * @returns A promise that resolves to the current VotingPolicy.
   * @throws PolicyUndefinedError when no policy has been defined yet.
   */
  getVotingPolicyByCommunity(query: GetVotingPolicyByCommunityQuery): Promise<VotingPolicy>;

  /**
   * Answers the standing question: standing plus acceptance.
   * @param query Carries communityId.
   * @returns A promise that resolves to the CommunityStandingAnswer.
   */
  getStandingByCommunity(query: GetStandingByCommunityQuery): Promise<CommunityStandingAnswer>;

  /**
   * Lists the entrusted administrators of a community.
   * @param query Carries communityId.
   * @returns A promise that resolves to the CommunityAdmin list.
   */
  getAdministratorsByCommunity(query: GetAdministratorsByCommunityQuery): Promise<CommunityAdmin[]>;
}
/**
 * Injection token for the {@link CommunityQueryService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const COMMUNITY_QUERY_SERVICE = Symbol('COMMUNITY_QUERY_SERVICE');
