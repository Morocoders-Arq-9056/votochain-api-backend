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
 * Domain port for User write use cases (CQRS command side).
 *
 * Naming follows skill ddd-guideliness v1.0.11: one method per command,
 * `methodName = lowerCamel(ClassName without Command suffix)`, receiving
 * the command object. Implementations live in application and hold no
 * business rules; every invariant is enforced by the `User` aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export interface UserCommandService {
  /**
   * Handles the user sign-up process.
   * The command carries only the contact address; UserId and PersonId are minted
   * inside the User.signup factory. Email uniqueness is checked in application.
   *
   * @param command The command containing the contact address for signing up a user.
   * @returns A promise that resolves to the newly created UserId.
   */
  signUp(command: SignUpCommand): Promise<UserId>;

  /**
   * Proves a user in and opens the single session, superseding any prior one.
   * @param command Carries userId and the observed proof kind.
   */
  signIn(command: SignInCommand): Promise<void>;

  /**
   * Closes the open session with reason ASKED.
   * @param command Carries userId.
   */
  signOut(command: SignOutCommand): Promise<void>;

  /**
   * Changes the local secret and ends the open session (PROOF_CHANGED).
   * @param command Carries userId and the new secret reference.
   */
  changeSecret(command: ChangeSecretCommand): Promise<void>;

  /**
   * Changes the contact address, resetting verified standing to unverified.
   * @param command Carries userId and the new email.
   */
  changeEmail(command: ChangeEmailCommand): Promise<void>;

  /**
   * Records an observed email confirmation for the recorded address.
   * Delivery and channel proof are executed outside; this only judges standing.
   * @param command Carries userId and the confirmed email.
   */
  verifyEmail(command: VerifyEmailCommand): Promise<void>;

  /**
   * Links the single agreed outside proof (auth0) to an ACTIVE identity.
   * @param command Carries userId, provider and external id.
   */
  linkOutsideIdentity(command: LinkOutsideIdentityCommand): Promise<void>;

  /**
   * Unlinks the outside proof, refusing when it is the final way to prove.
   * @param command Carries userId and provider.
   */
  unlinkOutsideIdentity(command: UnlinkOutsideIdentityCommand): Promise<void>;

  /**
   * Grants a global technical role (ADMIN/USER).
   * @param command Carries userId and role.
   */
  grantSystemRole(command: GrantSystemRoleCommand): Promise<void>;

  /**
   * Revokes a held role, refusing when it would remove the final ADMIN.
   * @param command Carries userId and role.
   */
  revokeSystemRole(command: RevokeSystemRoleCommand): Promise<void>;

  /**
   * Suspends access (admin decision or failed-proof policy) and ends the session.
   * @param command Carries userId and reason.
   */
  suspendAccess(command: SuspendAccessCommand): Promise<void>;

  /**
   * Restores a SUSPENDED identity to ACTIVE once the cause is resolved.
   * @param command Carries userId.
   */
  restoreAccess(command: RestoreAccessCommand): Promise<void>;
}
/**
 * Injection token for the {@link UserCommandService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');
