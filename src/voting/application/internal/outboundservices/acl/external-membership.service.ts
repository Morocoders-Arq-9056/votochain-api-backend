import { Inject, Injectable } from "@nestjs/common";
import { MEMBERSHIP_CONTEXT_FACADE, type MembershipContextFacade } from "../../../../../membership/interfaces/acl/membership-context.facade.js";
import { CommunityId } from "../../../../domain/model/valueobjects/community-id.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { EligibilitySnapshot } from "../../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";

/**
 * Outbound ACL toward Membership (R2): judges roster eligibility now and
 * freezes the snapshot Voting keeps (H3: past judgments are never
 * rewritten). Returning the consumer's own VOs (not facade primitives) is
 * the ACL's job: the consumer translates the provider's answer into its
 * model, mirroring the skill's ExternalVesselService → RouteProposal shape.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalMembershipService {
  /**
   * Wires the consumer over the published Membership facade.
   * @param facade Membership answers (primitives at the boundary).
   */
  constructor(@Inject(MEMBERSHIP_CONTEXT_FACADE) private readonly facade: MembershipContextFacade) {}

  /**
   * Judges whether the person is eligible in the community right now,
   * freezing the snapshot when eligible.
   * @param personId Person id (`per-` prefixed string).
   * @param communityId Community id (`com-` prefixed string).
   */
  async judgeEligibility(personId: string, communityId: string): Promise<{ eligible: boolean; snapshot: EligibilitySnapshot | null }> {
    const answer = await this.facade.judgeEligibility(personId, communityId);
    if (!answer.eligible) return { eligible: false, snapshot: null };
    return {
      eligible: true,
      snapshot: EligibilitySnapshot.freeze({
        personId: PersonId.of(personId), communityId: CommunityId.of(communityId),
        verdict: 'ELIGIBLE', reference: answer.snapshotRef,
      }),
    };
  }
}
