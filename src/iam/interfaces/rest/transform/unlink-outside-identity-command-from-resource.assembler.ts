import { UnlinkOutsideIdentityCommand } from '../../../domain/model/commands/unlink-outside-identity.command.js';
import { IamParamsAssembler } from './iam-params.assembler.js';

/**
 * Translates the outside-unlink path params into their command.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class UnlinkOutsideIdentityCommandFromResourceAssembler {
  /**
   * Builds the command from path params (both skip class-validator).
   * @param id Raw user id path string.
   * @param provider Raw prover name path string.
   */
  static toCommand(id: string, provider: string): UnlinkOutsideIdentityCommand {
    return new UnlinkOutsideIdentityCommand(
      IamParamsAssembler.toUserId(id),
      IamParamsAssembler.toProver(provider).provider,
    );
  }
}
