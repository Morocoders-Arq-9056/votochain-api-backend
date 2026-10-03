import { ChangeSecretCommand } from '../../../domain/model/commands/change-secret.command.js';
import { ChangeSecretResource } from '../resources/outside-identity.resource.js';
import { IamParamsAssembler } from './iam-params.assembler.js';

/**
 * Translates the secret-rotation resource into its command (path id + body).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class ChangeSecretCommandFromResourceAssembler {
  /**
   * Builds the command from a path id and a validated resource.
   * @param id Raw user id path string.
   * @param resource Validated secret-rotation resource.
   */
  static toCommand(id: string, resource: ChangeSecretResource): ChangeSecretCommand {
    return new ChangeSecretCommand(IamParamsAssembler.toUserId(id), resource.newSecret);
  }
}
