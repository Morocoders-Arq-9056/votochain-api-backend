import { DenyVoteAuthorizationCommand } from "../model/commands/deny-vote-authorization.command.js";
import { ExpireVoteAuthorizationCommand } from "../model/commands/expire-vote-authorization.command.js";
import { GrantVoteAuthorizationCommand } from "../model/commands/grant-vote-authorization.command.js";
import { RequestVoteAuthorizationCommand } from "../model/commands/request-vote-authorization.command.js";
import { AuthorizationId } from "../model/valueobjects/authorization-id.value-object.js";

export const AUTHORIZATION_COMMAND_SERVICE = Symbol('AUTHORIZATION_COMMAND_SERVICE');

/**
 * Domain port for VoteAuthorization writes (UC3 request/grant/deny/expire).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */

export interface VoteAuthorizationCommandService {
  requestVoteAuthorization(command: RequestVoteAuthorizationCommand): Promise<AuthorizationId>;
  grantVoteAuthorization(command: GrantVoteAuthorizationCommand): Promise<void>;
  denyVoteAuthorization(command: DenyVoteAuthorizationCommand): Promise<void>;
  expireVoteAuthorization(command: ExpireVoteAuthorizationCommand): Promise<void>;
}
