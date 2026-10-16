/**
 * Published ACL this bounded context exposes to other contexts.
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from MembershipModule via
 * MEMBERSHIP_CONTEXT_FACADE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const MEMBERSHIP_CONTEXT_FACADE = Symbol('MEMBERSHIP_CONTEXT_FACADE');

/**
 * Eligibility answer shape: verdict, machine-readable reason and the frozen
 * snapshot reference consumers copy.
 */
export interface JudgeEligibilityAnswerDto {
  /** Whether the person is eligible right now. */
  eligible: boolean;
  /** Reason: ELIGIBLE | NOT_A_MEMBER | NOT_ELIGIBLE_<standing>. */
  reason: string;
  /** Frozen snapshot reference to copy. */
  snapshotRef: string;
}

/**
 * Facade published by Membership for eligibility and roster consumers
 * (Voting per authorization, OCR per belonging precondition).
 */
export interface MembershipContextFacade {
  /**
   * Judges eligibility now; absence answers NOT_A_MEMBER, never throws.
   * @param personId Person id (`per-` prefixed string).
   * @param communityId Community id (`com-` prefixed string).
   */
  judgeEligibility(personId: string, communityId: string): Promise<JudgeEligibilityAnswerDto>;

  /**
   * Lists the person ids holding an ACTIVE membership in the community.
   * @param communityId Community id (`com-` prefixed string).
   */
  getRoster(communityId: string): Promise<string[]>;

  /**
   * Answers whether the person holds any live (non-terminated) membership,
   * regardless of community (R8 belonging precondition for OCR).
   * @param personId Person id (`per-` prefixed string).
   */
  belongsToAnyCommunity(personId: string): Promise<boolean>;
}
