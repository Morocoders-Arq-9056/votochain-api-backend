import { ProofKind } from "./proof-kind.value-object.js";

/**
 * Interface defining acessing workflow actions for iam aggregate.
 *  
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export interface AccessStandable {
  /**
   * Performs the sign-in action for the implementing class.
   * @param kind The kind of proof used for signing in.
   */
  signIn(kind: ProofKind): void; 

  /**
   * Performs the sign-out action for the implementing class.
   */
  signOut(): void; 

  /**
   * Changes the secret for the implementing class.
   */
  changeSecret(): void;

  /**
   * Suspends the implementing class with a given reason.
   * @param reason The reason for suspension.
   */
  suspend(reason: string): void; 

  /**
   * Restores the implementing class from suspension.
   */
  restore(): void;
}