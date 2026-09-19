import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, NotFoundException, Patch, Post, UseFilters } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { UserResource } from '../resources/user.resource.js';
import { SignUpResource } from '../resources/sign-up.resource.js';
import { SignInResource } from '../resources/sign-in.resource.js';
import { ChangeEmailResource, VerifyEmailResource } from '../resources/change-email.resource.js';
import { SuspendAccessResource, SystemRoleResource, UserIdResource } from '../resources/system-role.resource.js';
import { ChangeSecretResource, OutsideIdentityResource } from '../resources/outside-identity.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { SignUpCommandFromResourceAssembler } from '../transform/sign-up-command-from-resource.assembler.js';
import { SignInCommand } from '../../../domain/model/commands/sign-in.command.js';
import { SignOutCommand } from '../../../domain/model/commands/sign-out.command.js';
import { ChangeSecretCommand } from '../../../domain/model/commands/change-secret.command.js';
import { ChangeEmailCommand } from '../../../domain/model/commands/change-email.command.js';
import { VerifyEmailCommand } from '../../../domain/model/commands/verify-email.command.js';
import { LinkOutsideIdentityCommand } from '../../../domain/model/commands/link-outside-identity.command.js';
import { UnlinkOutsideIdentityCommand } from '../../../domain/model/commands/unlink-outside-identity.command.js';
import { GrantSystemRoleCommand } from '../../../domain/model/commands/grant-system-role.command.js';
import { RevokeSystemRoleCommand } from '../../../domain/model/commands/revoke-system-role.command.js';
import { SuspendAccessCommand } from '../../../domain/model/commands/suspend-access.command.js';
import { RestoreAccessCommand } from '../../../domain/model/commands/restore-access.command.js';
import { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
import { parseProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';
import { parseSystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for the IAM bounded context.
 *
 * Maps validated resources to command/query objects and delegates to the
 * service tokens; re-queries after writes to rebuild the response (accepted
 * CQRS round-trip). Holds no business rules. Domain rejections surface
 * through {@link IamExceptionFilter}.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@ApiTags('iam')
@Controller('iam/users')
@UseFilters(IamExceptionFilter)
export class AuthenticationController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(USER_COMMAND_SERVICE) private readonly commands: UserCommandService,
    @Inject(USER_QUERY_SERVICE) private readonly queries: UserQueryService,
  ) {}

  /**
   * Registers a fresh identity (REGISTERED, unverified).
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiBadRequestResponse({ description: 'Malformed email' })
  @ApiConflictResponse({ description: 'Email already held' })
  async signUp(@Body() resource: SignUpResource): Promise<UserResource> {
    const command = SignUpCommandFromResourceAssembler.toCommandFromResource(resource);
    const userId = await this.commands.signUp(command);
    return this.requery(userId);
  }

  /**
   * Proves the user in; a second call supersedes the prior session.
   */
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Suspended or proof not held' })
  async signIn(@Body() resource: SignInResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.signIn(new SignInCommand(userId, parseProofKind(resource.proofKind)));
    return this.requery(userId);
  }

  /**
   * Closes the open session with reason ASKED.
   */
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'No open session' })
  async signOut(@Body() resource: UserIdResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.signOut(new SignOutCommand(userId));
    return this.requery(userId);
  }

  /**
   * Rotates the local secret and ends the open session.
   */
  @Post('change-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async changeSecret(@Body() resource: ChangeSecretResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.changeSecret(new ChangeSecretCommand(userId, resource.newSecret));
    return this.requery(userId);
  }

  /**
   * Changes the contact address (verified standing resets).
   */
  @Patch('email')
  @ApiOkResponse({ type: UserResource })
  @ApiBadRequestResponse({ description: 'Malformed email' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Address already held or suspended' })
  async changeEmail(@Body() resource: ChangeEmailResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.changeEmail(new ChangeEmailCommand(userId, resource.newEmail));
    return this.requery(userId);
  }

  /**
   * Records the observed email confirmation (REGISTERED becomes ACTIVE).
   */
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async verifyEmail(@Body() resource: VerifyEmailResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.verifyEmail(new VerifyEmailCommand(userId, resource.email));
    return this.requery(userId);
  }

  /**
   * Links the single agreed outside proof.
   */
  @Post('outside-identities/link')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Already linked or not active' })
  async linkOutside(@Body() resource: OutsideIdentityResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.linkOutsideIdentity(
      new LinkOutsideIdentityCommand(userId, resource.provider, resource.externalId),
    );
    return this.requery(userId);
  }

  /**
   * Unlinks the outside proof (refused when final way to prove).
   */
  @Post('outside-identities/unlink')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Last proof refused' })
  async unlinkOutside(@Body() resource: OutsideIdentityResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.unlinkOutsideIdentity(new UnlinkOutsideIdentityCommand(userId, resource.provider));
    return this.requery(userId);
  }

  /**
   * Grants a global technical system role.
   */
  @Post('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role already held' })
  async grantRole(@Body() resource: SystemRoleResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.grantSystemRole(new GrantSystemRoleCommand(userId, parseSystemRole(resource.role)));
    return this.requery(userId);
  }

  /**
   * Revokes a held role (final ADMIN refused as invariant).
   */
  @Delete('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role not held or last admin' })
  async revokeRole(@Body() resource: SystemRoleResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.revokeSystemRole(new RevokeSystemRoleCommand(userId, parseSystemRole(resource.role)));
    return this.requery(userId);
  }

  /**
   * Suspends access with reason and ends the open session.
   */
  @Post('suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async suspend(@Body() resource: SuspendAccessResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.suspendAccess(new SuspendAccessCommand(userId, resource.reason));
    return this.requery(userId);
  }

  /**
   * Restores a SUSPENDED identity to ACTIVE.
   */
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async restore(@Body() resource: UserIdResource): Promise<UserResource> {
    const userId = UserId.of(resource.userId);
    await this.commands.restoreAccess(new RestoreAccessCommand(userId));
    return this.requery(userId);
  }

  /**
   * Re-reads the saved aggregate to rebuild the response resource.
   * @param userId Identity just written.
   */
  private async requery(userId: UserId): Promise<UserResource> {
    const user = await this.queries.getUserById(new GetUserByIdQuery(userId));
    if (!user) throw new NotFoundException();
    return UserResourceFromEntityAssembler.toResourceFromEntity(user);
  }
}
