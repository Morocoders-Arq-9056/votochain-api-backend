import { AnswerVerificationChallengeCommand } from "../../../domain/model/commands/answer-verification-challenge.command.js";
import { AnswerChallengeResource } from "../resources/answer-challenge.resource.js";
import { VerificationParamsAssembler } from "./verification-params.assembler.js";

/**
 * Translates the answer resource into its command (path id + body code).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-29
 */
export class AnswerVerificationChallengeCommandFromResourceAssembler {
  /**
   * Builds the command from a path id and a validated resource.
   * @param id Raw challenge id path string.
   * @param resource Validated answer resource carrying the presented code.
   */
  static toCommand(id: string, resource: AnswerChallengeResource): AnswerVerificationChallengeCommand {
    return new AnswerVerificationChallengeCommand(
      VerificationParamsAssembler.toChallengeId(id),
      resource.code,
    );
  }
}
