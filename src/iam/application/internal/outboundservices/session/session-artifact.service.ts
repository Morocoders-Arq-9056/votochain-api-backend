/**
 * Outbound port instructing the external executor to issue/end session
 * artifacts. The domain facts (`UserSignedInEvent`/`UserSignedOutEvent`) stay
 * inside IAM; artifact mechanics live outside the boundary.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export const SESSION_ARTIFACT_SERVICE = Symbol('SESSION_ARTIFACT_SERVICE');

/**
 * Technology port for session proof artifacts.
 */
export interface SessionArtifactService {
  /**
   * Instructs the executor to issue the session proof for the user.
   * @param userId Technical identity id.
   */
  issue(userId: string): Promise<void>;

  /**
   * Instructs the executor to end the session proof with the given reason.
   * @param userId Technical identity id.
   * @param reason Sign-out reason (ASKED | SUPERSEDED | PROOF_CHANGED | SUSPENDED).
   */
  end(userId: string, reason: string): Promise<void>;
}
