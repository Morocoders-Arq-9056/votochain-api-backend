import { AnswerVerificationChallengeCommand } from "../model/commands/answer-verification-challenge.command.js";
import { ExpireVerificationChallengeCommand } from "../model/commands/expire-verification-challenge.command.js";
import { RequestVerificationChallengeCommand } from "../model/commands/request-verification-challenge.command.js";
import { ChallengeId } from "../model/valueobjects/challenge-id.value-object.js";

/**
 * Interface for the verification command service.
 * This service is responsible for handling commands related to verification challenges.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export interface VerificationCommandService {
  /**
   * Handles the request of a verification challenge for a person and purpose.
   * Supersedes the prior OPEN challenge for the pair, if any.
   *
   * @param command The command containing the person and purpose.
   * @returns A promise that resolves to the newly created ChallengeId.
   */
  requestVerificationChallenge(command: RequestVerificationChallengeCommand): Promise<ChallengeId>;

  /**
   * Handles the answer of a verification challenge with a presented code.
   * Confirms on a holding code; counts the attempt otherwise.
   *
   * @param command The command containing the challenge and presented code.
   * @returns A promise that resolves when the answer process is complete.
   */
  answerVerificationChallenge(command: AnswerVerificationChallengeCommand): Promise<void>;

  /**
   * Handles the explicit expiry sweep of a verification challenge.
   *
   * @param command The command containing the challenge to expire.
   * @returns A promise that resolves when the expiry process is complete.
   */
  expireVerificationChallenge(command: ExpireVerificationChallengeCommand): Promise<void>;
}
export const VERIFICATION_COMMAND_SERVICE = Symbol('VERIFICATION_COMMAND_SERVICE');
