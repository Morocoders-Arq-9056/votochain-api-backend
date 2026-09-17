/**
 * Outbound port observed by IAM: does the offered proof hold for this attempt?
 *
 * Executor-first (locked H2): Auth0 (or the Fake in Sprint-01) executes the
 * proof mechanics; IAM only judges the verdict and owns the history. The
 * verdict is always observed BEFORE the unit of work — network I/O never
 * runs inside the DB transaction.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export const PROOF_VERIFICATION_SERVICE = Symbol('PROOF_VERIFICATION_SERVICE');

/**
 * Technology port for proof verdicts.
 */
export interface ProofVerificationService {
  /**
   * Answers whether the offered proof holds for the given user.
   * @param userId Technical identity id (`usr-` prefixed string).
   */
  holds(userId: string): Promise<boolean>;
}
