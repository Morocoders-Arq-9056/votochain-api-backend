/**
 * Published ACL this bounded context exposes to other contexts (R9/R13/R14).
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from IamModule via IAM_CONTEXT_FACADE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export const IAM_CONTEXT_FACADE = Symbol('IAM_CONTEXT_FACADE');

/**
 * Answer shape for access standing: may-act flag, held roles, session flag.
 */
export interface AccessStandingAnswerDto {
  /** Whether the person may act now (ACTIVE standing). */
  mayAct: boolean;
  /** Held global technical roles. */
  roles: string[];
  /** Whether a session is currently open. */
  sessionOpen: boolean;
}

/**
 * Facade published by IAM for every gated use case across contexts.
 */
export interface IamContextFacade {
  /**
   * Answers access standing for the given person id string.
   * @param personId Person id (`per-` prefixed string).
   */
  answerAccessStanding(personId: string): Promise<AccessStandingAnswerDto | null>;

  /**
   * Lists the global technical roles held by the given person id string.
   * @param personId Person id (`per-` prefixed string).
   */
  getSystemRoles(personId: string): Promise<string[]>;

  /**
   * Records the observed email confirmation (R9 reception).
   * Called by Verification's own ChallengeConfirmedEventHandler; the code
   * itself never crosses, only the confirmation fact as primitives.
   * @param personId Person id (`per-` prefixed string).
   */
  markVerified(personId: string): Promise<void>;
}
