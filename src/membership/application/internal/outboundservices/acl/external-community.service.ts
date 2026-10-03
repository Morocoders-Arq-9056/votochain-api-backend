import { Inject, Injectable } from "@nestjs/common";
import { COMMUNITY_CONTEXT_FACADE } from "../../../../../community/interfaces/acl/community-context.facade.js";
import type { CommunityContextFacade } from "../../../../../community/interfaces/acl/community-context.facade.js";

/**
 * Outbound ACL through which Membership checks community acceptance
 * (UC1: a pair only registers while the community accepts members).
 * Primitives-only at the boundary; Community's value objects never enter
 * this context. Unknown communities answer "not accepting".
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalCommunityService {
  /**
   * Wires the consumer over the published Community facade token.
   * @param communities Facade published by CommunityModule (UC1 acceptance).
   */
  constructor(@Inject(COMMUNITY_CONTEXT_FACADE) private readonly communities: CommunityContextFacade) {}

  /**
   * Answers whether the community accepts member registrations now.
   * @param communityId Community id (`com-` prefixed string).
   */
  async acceptsMembers(communityId: string): Promise<boolean> {
    try {
      return (await this.communities.answerStanding(communityId)).acceptsMembers;
    } catch {
      return false;
    }
  }
}
