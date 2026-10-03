import { Injectable } from "@nestjs/common";
import { EligibilityPolicyService } from "../../../application/internal/outboundservices/eligibility/eligibility-policy.service.js";
import { EligibilitySnapshot } from "../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipStatus } from "../../../domain/model/valueobjects/membership-status.value-object.js";

/**
 * Test fake for the eligibility strategy with a configurable verdict.
 * Bind via `overrideProvider(ELIGIBILITY_POLICY)` in unit tests of the
 * aggregate consumers and the command service.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class FakeEligibilityPolicyService implements EligibilityPolicyService {
  /**
   * Creates the fake with an initial verdict.
   * @param verdict Verdict every judgment answers until reconfigured.
   */
  constructor(private verdict = true) {}

  /**
   * Reconfigures the verdict answered from now on.
   * @param verdict New verdict.
   */
  setVerdict(verdict: boolean): void {
    this.verdict = verdict;
  }

  /**
   * Answers the configured verdict regardless of standing.
   * @param status Standing observed at judgment time.
   * @param snapshot Frozen draft.
   */
  judge(status: MembershipStatus, snapshot: EligibilitySnapshot): boolean {
    void status;
    void snapshot;
    return this.verdict;
  }
}
