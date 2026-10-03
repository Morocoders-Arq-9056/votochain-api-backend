import { Membership } from "../model/aggregates/membership.aggregate.js";
import { GetMembershipByIdQuery } from "../model/queries/get-membership-by-id.query.js";
import { GetMembershipByPersonAndCommunityQuery } from "../model/queries/get-membership-by-person-and-community.query.js";
import { GetMembershipsByPersonQuery } from "../model/queries/get-memberships-by-person.query.js";
import { GetRosterByCommunityQuery } from "../model/queries/get-roster-by-community.query.js";

/**
 * Domain port for Membership read use cases (CQRS query side).
 *
 * Queries judge current state and answer; they mutate nothing and produce
 * no facts. The roster answers ACTIVE memberships only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface MembershipQueryService {
  /** Finds a membership by identity, or null when unknown. */
  getMembershipById(query: GetMembershipByIdQuery): Promise<Membership | null>;
  /** Finds the live (non-terminated) membership for a pair, or null. */
  getMembershipByPersonAndCommunity(query: GetMembershipByPersonAndCommunityQuery): Promise<Membership | null>;
  /** Lists the ACTIVE memberships of a community (the roster). */
  getRosterByCommunity(query: GetRosterByCommunityQuery): Promise<Membership[]>;
  /** Lists the live memberships held by a person. */
  getMembershipsByPerson(query: GetMembershipsByPersonQuery): Promise<Membership[]>;
}
/**
 * Injection token for the {@link MembershipQueryService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const MEMBERSHIP_QUERY_SERVICE = Symbol('MEMBERSHIP_QUERY_SERVICE');
