import { EligibilitySnapshot } from "../../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipStatus } from "../../../../domain/model/valueobjects/membership-status.value-object.js";

/**
 * Strategy port judging eligibility from the observed standing and the
 * frozen snapshot draft. Changing the rule never touches the aggregate:
 * swap the bound adapter (default vs fake) via `useClass`.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const ELIGIBILITY_POLICY = Symbol('ELIGIBILITY_POLICY');

export interface EligibilityPolicyService {
  /**
   * Judges whether the observed standing is eligible.
   * @param status Standing observed at judgment time.
   * @param snapshot Frozen draft carrying person, community and reference.
   */
  judge(status: MembershipStatus, snapshot: EligibilitySnapshot): boolean;
}
