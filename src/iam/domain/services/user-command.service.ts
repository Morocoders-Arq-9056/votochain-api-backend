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
import { UserId } from "../model/valueobjects/user-id.js";

export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');
export interface UserCommandService {
  handle(command: SignUpCommand): Promise<UserId>;
  handle(command: SignInCommand): Promise<void>;
  handle(command: SignOutCommand): Promise<void>;
  handle(command: ChangeSecretCommand): Promise<void>;
  handle(command: ChangeEmailCommand): Promise<void>;
  handle(command: VerifyEmailCommand): Promise<void>;
  handle(command: LinkOutsideIdentityCommand): Promise<void>;
  handle(command: UnlinkOutsideIdentityCommand): Promise<void>;
  handle(command: GrantSystemRoleCommand): Promise<void>;
  handle(command: RevokeSystemRoleCommand): Promise<void>;
  handle(command: SuspendAccessCommand): Promise<void>;
  handle(command: RestoreAccessCommand): Promise<void>;
}