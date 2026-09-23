/**
 * Interface that defines the behavior of a challenge that can be stood up for verification purposes.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export interface ChallengeStandable {
  /**
   * Performs the action of answering a challenge with a given boolean value and timestamp.
   * @param holds A boolean indicating whether the challenge holds true or not.
   * @param now A Date object representing the current timestamp when the answer is provided.
   */
  answer(holds: boolean, now: Date): void;

  /**
   * Supersedes the current challenge, marking it as no longer valid or relevant.
   */
  supersede(): void;

  /**
   * Expires the challenge, marking it as no longer valid due to the passage of time.
   * @param now A Date object representing the current timestamp when the challenge is expired.
   */
  expire(now: Date): void;
}