import { Inject, Injectable } from "@nestjs/common";
import { MEMBERSHIP_REPOSITORY } from "../../../domain/repositories/membership.repository.js";
import type { MembershipRepository } from "../../../domain/repositories/membership.repository.js";
import { MembershipQueryService } from "../../../domain/services/membership-query.service.js";
import { GetMembershipByIdQuery } from "../../../domain/model/queries/get-membership-by-id.query.js";
import { GetMembershipByPersonAndCommunityQuery } from "../../../domain/model/queries/get-membership-by-person-and-community.query.js";
import { GetMembershipsByPersonQuery } from "../../../domain/model/queries/get-memberships-by-person.query.js";
import { GetRosterByCommunityQuery } from "../../../domain/model/queries/get-roster-by-community.query.js";
import { Membership } from "../../../domain/model/aggregates/membership.aggregate.js";

/**
 * Read-only query service for membership detail, pair lookup, roster and
 * per-person memberships. No unit of work, no mutations, no events: pure
 * orchestration over the repository port.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipQueryServiceImpl implements MembershipQueryService {
  /**
   * Wires the query service over the repository port.
   * @param memberships Repository port for the Membership aggregate.
   */
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
  ) {}

  /**
   * Returns the membership for the given id, or null when unknown.
   * @inheritdoc
   */
  async getMembershipById(query: GetMembershipByIdQuery): Promise<Membership | null> {
    return this.memberships.findById(query.membershipId);
  }

  /**
   * Returns the live membership for a pair, or null when absent.
   * @inheritdoc
   */
  async getMembershipByPersonAndCommunity(query: GetMembershipByPersonAndCommunityQuery): Promise<Membership | null> {
    return this.memberships.findLiveByPersonAndCommunity(query.personId, query.communityId);
  }

  /**
   * Returns the ACTIVE memberships of a community (the roster).
   * @inheritdoc
   */
  async getRosterByCommunity(query: GetRosterByCommunityQuery): Promise<Membership[]> {
    return this.memberships.findActiveByCommunity(query.communityId);
  }

  /**
   * Returns the live memberships held by a person.
   * @inheritdoc
   */
  async getMembershipsByPerson(query: GetMembershipsByPersonQuery): Promise<Membership[]> {
    return this.memberships.findLiveByPerson(query.personId);
  }
}
