import { Membership } from "../model/aggregates/membership.aggregate.js";
import { CommunityId } from "../model/valueobjects/community-id.value-object.js";
import { MembershipId } from "../model/valueobjects/membership-id.value-object.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";

/**
 * Persistence port for the Membership aggregate root.
 *
 * "Live" means any standing except TERMINATED: at most one live membership
 * exists per (person, community) pair, enforced by the `uq_live_pair` partial
 * unique index with the application-level `findLiveByPersonAndCommunity` guard.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface MembershipRepository {
  /**
   * Finds a membership by its identity, whatever its standing.
   * @param id Membership identity.
   */
  findById(id: MembershipId): Promise<Membership | null>;

  /**
   * Finds the live membership for a pair, or null when none (or only a
   * terminated one) exists.
   * @param personId Person reference.
   * @param communityId Community reference.
   */
  findLiveByPersonAndCommunity(personId: PersonId, communityId: CommunityId): Promise<Membership | null>;

  /**
   * Finds the ACTIVE memberships of a community (the roster).
   * @param communityId Community reference.
   */
  findActiveByCommunity(communityId: CommunityId): Promise<Membership[]>;

  /**
   * Finds the live memberships held by a person.
   * @param personId Person reference.
   */
  findLiveByPerson(personId: PersonId): Promise<Membership[]>;

  /**
   * Persists the whole aggregate state in one row.
   * @param membership Aggregate to save.
   */
  save(membership: Membership): Promise<void>;
}
/**
 * Injection token for the {@link MembershipRepository} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const MEMBERSHIP_REPOSITORY = Symbol('MEMBERSHIP_REPOSITORY');
