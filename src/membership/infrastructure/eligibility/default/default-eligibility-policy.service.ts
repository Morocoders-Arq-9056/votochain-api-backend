import { Injectable } from "@nestjs/common";
import { EligibilityPolicyService } from "../../../application/internal/outboundservices/eligibility/eligibility-policy.service.js";
import { EligibilitySnapshot } from "../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipStatus } from "../../../domain/model/valueobjects/membership-status.value-object.js";

/**
 * Default eligibility strategy: only ACTIVE members are eligible. Changing
 * the rule means binding another adapter to ELIGIBILITY_POLICY — the
 * aggregate never changes.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class DefaultEligibilityPolicyService implements EligibilityPolicyService {
  /**
   * Judges eligibility from the observed standing.
   * @param status Standing observed at judgment time.
   * @param snapshot Frozen draft (carries person, community, reference).
   */
  judge(status: MembershipStatus, snapshot: EligibilitySnapshot): boolean {
    void snapshot;
    return status === MembershipStatus.ACTIVE;
  }
}
