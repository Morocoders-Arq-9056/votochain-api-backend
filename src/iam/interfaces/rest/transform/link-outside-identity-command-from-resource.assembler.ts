import { LinkOutsideIdentityCommand } from '../../../domain/model/commands/link-outside-identity.command.js';
import { LinkOutsideIdentityResource } from '../resources/outside-identity.resource.js';
import { IamParamsAssembler } from './iam-params.assembler.js';

/**
 * Translates the outside-link resource into its command (path id + body).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class LinkOutsideIdentityCommandFromResourceAssembler {
  /**
   * Builds the command from a path id and a validated resource.
   * @param id Raw user id path string.
   * @param resource Validated outside-link resource (provider allow-listed).
   */
  static toCommand(id: string, resource: LinkOutsideIdentityResource): LinkOutsideIdentityCommand {
    return new LinkOutsideIdentityCommand(IamParamsAssembler.toUserId(id), resource.provider, resource.externalId);
  }
}
