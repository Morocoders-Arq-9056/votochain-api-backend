/**
 * Published ACL this bounded context exposes to other contexts.
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from CommunityModule via
 * COMMUNITY_CONTEXT_FACADE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export const COMMUNITY_CONTEXT_FACADE = Symbol('COMMUNITY_CONTEXT_FACADE');

/**
 * Policy answer shape: current threshold, basis and majority rule.
 */
export interface PolicyAnswerDto {
  /** Quorum threshold: how much participation is enough. */
  threshold: number;
  /** Quorum basis: enough of what. */
  basis: string;
  /** Majority rule: how a winner is recognized. */
  majorityRule: string;
}

/**
 * Standing answer shape: standing plus what is accepted now.
 */
export interface StandingAnswerDto {
  /** Current standing: REGISTERED | ACTIVE | SUSPENDED | ARCHIVED. */
  standing: string;
  /** Whether member registrations are accepted now. */
  acceptsMembers: boolean;
  /** Whether proposal openings are accepted now. */
  acceptsProposals: boolean;
}

/**
 * Facade published by Community for policy/standing consumers
 * (Voting per proposal opening, Membership per registration).
 */
export interface CommunityContextFacade {
  /**
   * Answers the current policy once defined, or null when undefined.
   * Only future proposal openings read it; frozen copies stay untouched.
   * @param communityId Community id (`com-` prefixed string).
   */
  answerPolicy(communityId: string): Promise<PolicyAnswerDto | null>;

  /**
   * Answers the standing question: standing plus acceptance (no facts).
   * @param communityId Community id (`com-` prefixed string).
   */
  answerStanding(communityId: string): Promise<StandingAnswerDto>;
}
