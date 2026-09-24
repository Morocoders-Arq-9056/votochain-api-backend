import { Inject, Injectable } from "@nestjs/common";
import { COMMUNITY_QUERY_SERVICE } from "../../domain/services/community-query.service.js";
import type { CommunityQueryService } from "../../domain/services/community-query.service.js";
import { CommunityId } from "../../domain/model/valueobjects/community-id.value-object.js";
import { GetCommunityByIdQuery } from "../../domain/model/queries/get-community-by-id.query.js";
import { CommunityNotFoundError } from "../../domain/exceptions/community-not-found.error.js";
import type { CommunityContextFacade, PolicyAnswerDto, StandingAnswerDto } from "../../interfaces/acl/community-context.facade.js";

/**
 * Application implementation of the published {@link CommunityContextFacade}.
 * Translates primitive boundary strings into domain VOs, delegates to the
 * query service, and translates back to primitives. Read-only: both answers
 * are queries, so no command service is wired here.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityContextFacadeImpl implements CommunityContextFacade {
  /**
   * Wires the facade over the read-side application service.
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(COMMUNITY_QUERY_SERVICE) private readonly queries: CommunityQueryService,
  ) {}

  /**
   * Answers the current policy once defined, or null when undefined.
   * @param communityId Community id (`com-` prefixed string).
   */
  async answerPolicy(communityId: string): Promise<PolicyAnswerDto | null> {
    const community = await this.require(communityId);
    const policy = community.policy;
    return policy
      ? { threshold: policy.threshold, basis: policy.basis, majorityRule: policy.majorityRule }
      : null;
  }

  /**
   * Answers the standing question: standing plus acceptance.
   * @param communityId Community id (`com-` prefixed string).
   */
  async answerStanding(communityId: string): Promise<StandingAnswerDto> {
    const community = await this.require(communityId);
    const answer = community.answerStanding();
    return { standing: answer.standing, acceptsMembers: answer.acceptsMembers, acceptsProposals: answer.acceptsProposals };
  }

  /**
   * Parses a community id string or raises the read rejection.
   * @param communityId Raw community id string.
   */
  private async require(communityId: string) {
    let id: CommunityId;
    try {
      id = CommunityId.of(communityId);
    } catch {
      throw new CommunityNotFoundError('community not found');
    }
    const community = await this.queries.getCommunityById(new GetCommunityByIdQuery(id));
    if (!community) throw new CommunityNotFoundError('community not found');
    return community;
  }
}
