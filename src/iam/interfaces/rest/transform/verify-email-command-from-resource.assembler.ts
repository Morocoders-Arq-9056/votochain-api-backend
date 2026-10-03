import { VerifyEmailCommand } from '../../../domain/model/commands/verify-email.command.js';
import { IamParamsAssembler } from './iam-params.assembler.js';

/**
 * Translates the email-verification request into its command (path id only;
 * the recorded address is resolved server-side, never trusted from the body).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class VerifyEmailCommandFromResourceAssembler {
  /**
   * Builds the command from a path id.
   * @param id Raw user id path string.
   */
  static toCommand(id: string): VerifyEmailCommand {
    return new VerifyEmailCommand(IamParamsAssembler.toUserId(id));
  }
}
