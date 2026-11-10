import { SignInCommand } from '../../../domain/model/commands/sign-in.command.js';
import { ProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';
import { SignInResource } from '../resources/sign-in.resource.js';

/**
 * Translates the classic-login sign-in resource into its command.
 */
export class SignInCommandFromResourceAssembler {
  /**
   * Builds the command from a validated resource (address + secret).
   * @param resource Validated sign-in resource.
   */
  static toCommandFromResource(resource: SignInResource): SignInCommand {
    return new SignInCommand(
      resource.email,
      resource.password ?? null,
      resource.proofKind ?? ProofKind.LOCAL,
    );
  }
}
