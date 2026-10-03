import { ChangeEmailCommand } from '../../../domain/model/commands/change-email.command.js';
import { ContactAddress } from '../../../domain/model/valueobjects/contact-address.value-object.js';
import { ChangeEmailResource } from '../resources/change-email.resource.js';
import { IamParamsAssembler } from './iam-params.assembler.js';

/**
 * Translates the email-change resource into its command (path id + body).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class ChangeEmailCommandFromResourceAssembler {
  /**
   * Builds the command from a path id and a validated resource.
   * @param id Raw user id path string.
   * @param resource Validated email-change resource (`@IsEmail`, infallible).
   */
  static toCommand(id: string, resource: ChangeEmailResource): ChangeEmailCommand {
    return new ChangeEmailCommand(IamParamsAssembler.toUserId(id), ContactAddress.create(resource.newEmail));
  }
}
