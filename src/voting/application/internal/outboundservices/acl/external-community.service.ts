import { Inject, Injectable } from "@nestjs/common";
import { COMMUNITY_CONTEXT_FACADE, type CommunityContextFacade } from "../../../../../community/interfaces/acl/community-context.facade.js";
import { QuorumSnapshot } from "../../../../domain/model/valueobjects/quorum-snapshot.value-object.js";

/**
 * Outbound ACL toward Community (R1): reads the live participation policy
 * and freezes it into the QuorumSnapshot shape Voting keeps. Returning the
 * consumer's own VOs (not facade primitives) is the ACL's job: the consumer
 * translates the provider's answer into its model, mirroring the skill's
 * ExternalVesselService → RouteProposal shape.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalCommunityService {
  constructor(@Inject(COMMUNITY_CONTEXT_FACADE) private readonly facade: CommunityContextFacade) {}

  async getPolicy(communityId: string): Promise<QuorumSnapshot | null> {
    const answer = await this.facade.answerPolicy(communityId);
    return answer ? QuorumSnapshot.freeze({ threshold: answer.threshold, basis: answer.basis }) : null;
  }
}
