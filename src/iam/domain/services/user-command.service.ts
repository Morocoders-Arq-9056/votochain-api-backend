import { ChangeEmailCommand } from "../model/commands/change-email.command.js";
import { ChangeSecretCommand } from "../model/commands/change-secret.command.js";
import { GrantSystemRoleCommand } from "../model/commands/grant-system-role.command.js";
import { LinkOutsideIdentityCommand } from "../model/commands/link-outside-identity.command.js";
import { RestoreAccessCommand } from "../model/commands/restore-access.command.js";
import { RevokeSystemRoleCommand } from "../model/commands/revoke-system-role.command.js";
import { SignInCommand } from "../model/commands/sign-in.command.js";
import { SignOutCommand } from "../model/commands/sign-out.command.js";
import { SignUpCommand } from "../model/commands/sign-up.command.js";
import { SuspendAccessCommand } from "../model/commands/suspend-access.command.js";
import { UnlinkOutsideIdentityCommand } from "../model/commands/unlink-outside-identity.command.js";
import { VerifyEmailCommand } from "../model/commands/verify-email.command.js";
import { UserId } from "../model/valueobjects/user-id.value-object.js";

/**
 * Interface for the user command service.
 * This service is responsible for handling commands related to user actions.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export interface UserCommandService {
  /**
   * Handles the user sign-up process.
   * 
   * @param command The command containing the necessary information for signing up a user.
   * @returns A promise that resolves to the newly created UserId. 
   */
  handle(command: SignUpCommand): Promise<UserId>;

  /**
   * Handles the user sign-in process.
   * @param command The command containing the necessary information for signing in a user.
   * @returns A promise that resolves when the sign-in process is complete.
   */
  handle(command: SignInCommand): Promise<void>;

  /**
   * Handles the user sign-out process.
   * @param command The command containing the necessary information for signing out a user.
   * @returns A promise that resolves when the sign-out process is complete.
   */
  handle(command: SignOutCommand): Promise<void>;

  /**
   * Handles the change of a user's secret.
   * @param command The command containing the necessary information for changing a user's secret.
   * @returns A promise that resolves when the secret change process is complete.
   */
  handle(command: ChangeSecretCommand): Promise<void>;

  /**
   * Handles the change of a user's email.
   * @param command The command containing the necessary information for changing a user's email.
   * @returns A promise that resolves when the email change process is complete.
   */
  handle(command: ChangeEmailCommand): Promise<void>;
  
  /**
   * Handles the verification of a user's email.
   * @param command The command containing the necessary information for verifying a user's email.
   * @returns A promise that resolves when the email verification process is complete.
   */
  handle(command: VerifyEmailCommand): Promise<void>;

  /**
   * Handles the linking of an outside identity to a user.
   * @param command The command containing the necessary information for linking an outside identity.
   * @returns A promise that resolves when the linking process is complete.
   */
  handle(command: LinkOutsideIdentityCommand): Promise<void>;

  /**
   * Handles the unlinking of an outside identity from a user.
   * @param command The command containing the necessary information for unlinking an outside identity.
   * @returns A promise that resolves when the unlinking process is complete.
   */
  handle(command: UnlinkOutsideIdentityCommand): Promise<void>;

  /**
   * Handles the granting of a system role to a user.
   * @param command The command containing the necessary information for granting a system role to a user.
   * @returns A promise that resolves when the granting process is complete.
   */
  handle(command: GrantSystemRoleCommand): Promise<void>;

  /**
   * Handles the revocation of a system role from a user.
   * @param command The command containing the necessary information for revoking a system role from a user.
   * @returns A promise that resolves when the revocation process is complete.
   */
  handle(command: RevokeSystemRoleCommand): Promise<void>;

  /**
   * Handles the suspension of a user's access.
   * @param command The command containing the necessary information for suspending a user's access.
   * @returns A promise that resolves when the suspension process is complete.
   */
  handle(command: SuspendAccessCommand): Promise<void>;

  /**
   * Handles the restoration of a user's access.
   * @param command The command containing the necessary information for restoring a user's access.
   * @returns A promise that resolves when the restoration process is complete.
   */
  handle(command: RestoreAccessCommand): Promise<void>;
}
export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');