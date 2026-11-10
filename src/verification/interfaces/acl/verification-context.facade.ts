/**
 * Published ACL this bounded context exposes to other contexts.
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from VerificationModule via
 * VERIFICATION_CONTEXT_FACADE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export const VERIFICATION_CONTEXT_FACADE = Symbol('VERIFICATION_CONTEXT_FACADE');

/**
 * Answer shape for a judged attempt: resulting standing plus attempts left.
 */
export interface AnswerChallengeResultDto {
  /** Resulting standing after the attempt. */
  standing: string;
  /** Attempts remaining on the challenge. */
  remaining: number;
}

/**
 * Standing answer shape: usable now, with how many attempts left.
 */
export interface ChallengeStandingDto {
  /** Whether an OPEN, in-window, unexhausted challenge exists. */
  usable: boolean;
  /** Attempts remaining on it (0 when none usable). */
  remaining: number;
}

/**
 * Facade published by Verification for channel-proof consumers.
 */
export interface VerificationContextFacade {
  /**
   * Opens a challenge for the pair, superseding the prior OPEN atomically.
   * @param personId Person id (`per-` prefixed string).
   * @param purpose Proof purpose (`login|email-verification|password-reset`).
   * @returns The new challenge id string.
   */
  requestChallenge(personId: string, purpose: string): Promise<string>;

  /**
   * Opens the initial email-verification challenge for a freshly registered
   * person (signup onboarding). Convenience over requestChallenge with the
   * closed purpose set — keeps IAM free of Verification's purpose language.
   * Idempotent: supersedes any prior OPEN challenge atomically.
   * @param personId Person id (`per-` prefixed string).
   * @returns The new challenge id string.
   */
  requestEmailVerification(personId: string): Promise<string>;

  /**
   * Judges one presented code against the open challenge.
   * @param challengeId Challenge id (`ch-` prefixed string).
   * @param code Presented plain code.
   */
  answerChallenge(challengeId: string, code: string): Promise<AnswerChallengeResultDto>;

  /**
   * Answers usability and remaining attempts for the pair (no facts).
   * @param personId Person id (`per-` prefixed string).
   * @param purpose Proof purpose (`login|email-verification|password-reset`).
   */
  getStanding(personId: string, purpose: string): Promise<ChallengeStandingDto>;
}
