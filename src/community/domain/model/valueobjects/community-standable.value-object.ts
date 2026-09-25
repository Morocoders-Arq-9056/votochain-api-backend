/**
 * Interface defining the standing workflow actions for the community aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export interface CommunityStandable {
  /**
   * Activates the implementing class once policy is defined and an administrator named.
   */
  activate(): void;

  /**
   * Suspends the implementing class with a given reason.
   * @param reason The reason for suspension.
   */
  suspend(reason: string): void;

  /**
   * Reactivates the implementing class once the cause is resolved.
   */
  reactivate(): void;

  /**
   * Archives the implementing class with a given reason. Terminal.
   * @param reason The reason for archival.
   */
  archive(reason: string): void;
}
