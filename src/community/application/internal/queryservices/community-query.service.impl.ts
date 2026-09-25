import { Inject, Injectable } from '@nestjs/common';
import { COMMUNITY_REPOSITORY } from '../../../domain/repositories/community.repository.js';
import type { CommunityRepository } from '../../../domain/repositories/community.repository.js';
import { CommunityQueryService } from '../../../domain/services/community-query.service.js';
import { GetAdministratorsByCommunityQuery } from '../../../domain/model/queries/get-administrators-by-community.query.js';
import { GetCommunityByIdQuery } from '../../../domain/model/queries/get-community-by-id.query.js';
import { GetStandingByCommunityQuery } from '../../../domain/model/queries/get-standing-by-community.query.js';
import { GetVotingPolicyByCommunityQuery } from '../../../domain/model/queries/get-voting-policy-by-community.query.js';
import { Community } from '../../../domain/model/aggregates/community.aggregate.js';
import { CommunityId } from '../../../domain/model/valueobjects/community-id.value-object.js';
import { CommunityAdmin } from '../../../domain/model/valueobjects/community-admin.value-object.js';
import { CommunityStandingAnswer } from '../../../domain/model/valueobjects/community-standing-answer.value-object.js';
import { VotingPolicy } from '../../../domain/model/valueobjects/voting-policy.value-object.js';
import { CommunityNotFoundError } from '../../../domain/exceptions/community-not-found.error.js';

/**
 * Read-only query service for community standing, policy and administrators.
 * No unit of work, no mutations, no events: pure orchestration over the
 * repository port plus the aggregate's answering operations.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityQueryServiceImpl implements CommunityQueryService {
  /**
   * Wires the query service over the repository port.
   * @param communities Repository port for the Community aggregate.
   */
  constructor(
    @Inject(COMMUNITY_REPOSITORY) private readonly communities: CommunityRepository,
  ) {}

  /**
   * Returns the community for the given id, or null when unknown.
   * @inheritdoc
   */
  async getCommunityById(query: GetCommunityByIdQuery): Promise<Community | null> {
    return this.communities.findById(query.communityId);
  }

  /**
   * Answers the current voting policy once defined.
   * @inheritdoc
   */
  async getVotingPolicyByCommunity(query: GetVotingPolicyByCommunityQuery): Promise<VotingPolicy> {
    const community = await this.require(query.communityId);
    return community.answerPolicy();
  }

  /**
   * Answers the standing question: standing plus acceptance.
   * @inheritdoc
   */
  async getStandingByCommunity(query: GetStandingByCommunityQuery): Promise<CommunityStandingAnswer> {
    const community = await this.require(query.communityId);
    return community.answerStanding();
  }

  /**
   * Lists the entrusted administrators of the community.
   * @inheritdoc
   */
  async getAdministratorsByCommunity(query: GetAdministratorsByCommunityQuery): Promise<CommunityAdmin[]> {
    const community = await this.require(query.communityId);
    return community.admins;
  }

  /**
   * Loads the aggregate or raises the read rejection for unknown ids.
   * @param id Community identity id.
   */
  private async require(id: CommunityId): Promise<Community> {
    const community = await this.communities.findById(id);
    if (!community) throw new CommunityNotFoundError('community not found');
    return community;
  }
}
