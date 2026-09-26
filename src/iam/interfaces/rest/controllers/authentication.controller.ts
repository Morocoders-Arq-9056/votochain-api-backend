import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Res, UseFilters } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { UserResource } from '../resources/user.resource.js';
import { SignUpResource } from '../resources/sign-up.resource.js';
import { SignInResource } from '../resources/sign-in.resource.js';
import { ChangeEmailResource, VerifyEmailResource } from '../resources/change-email.resource.js';
import { GrantRoleResource } from '../resources/system-role.resource.js';
import { StandingUpdateResource } from '../resources/standing-update.resource.js';
import { ChangeSecretResource, LinkOutsideIdentityResource } from '../resources/outside-identity.resource.js';
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
import { IllegalUserStateError } from '../../../domain/exceptions/illegal-user-state.error.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for the IAM bounded context.
 *
 * Resources hang off the identity: sessions open and close, contact facts
 * patch in place, outside proofs and roles join and leave collections,
 * standing moves by patch. Maps validated resources to command/query
 * objects and delegates to the service tokens; re-queries after writes to
 * rebuild the response (accepted CQRS round-trip). Holds no business rules.
 * Domain rejections surface through {@link IamExceptionFilter}.
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
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiBadRequestResponse({ description: 'Malformed email' })
  @ApiConflictResponse({ description: 'Email already held' })
  async signUp(
    @Body() resource: SignUpResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const command = SignUpCommandFromResourceAssembler.toCommandFromResource(resource);
    const userId = await this.commands.signUp(command);
    response.location(`/api/v1/iam/users/${userId.value}`);
    return this.requery(userId);
  }

  /**
   * Returns the identity.
   */
  @Get(':id')
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUser(@Param('id') id: string): Promise<UserResource> {
    return this.requery(this.toUserId(id));
  }

  /**
   * Opens the single session, superseding any prior one.
   */
  @Post(':id/sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Suspended or proof not held' })
  async signIn(
    @Param('id') id: string,
    @Body() resource: SignInResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.signIn(new SignInCommand(userId, parseProofKind(resource.proofKind)));
    response.location(`/api/v1/iam/users/${userId.value}/sessions/current`);
    return this.requery(userId);
  }

  /**
   * Closes the open session.
   */
  @Delete(':id/sessions/current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Session closed' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'No open session' })
  async signOut(@Param('id') id: string): Promise<void> {
    await this.commands.signOut(new SignOutCommand(this.toUserId(id)));
  }

  /**
   * Rotates the local secret and ends the open session.
   */
  @Patch(':id/secret')
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async changeSecret(
    @Param('id') id: string,
    @Body() resource: ChangeSecretResource,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.changeSecret(new ChangeSecretCommand(userId, resource.newSecret));
    return this.requery(userId);
  }

  /**
   * Changes the contact address (verified standing resets).
   */
  @Patch(':id/email')
  @ApiOkResponse({ type: UserResource })
  @ApiBadRequestResponse({ description: 'Malformed email' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Address already held or suspended' })
  async changeEmail(
    @Param('id') id: string,
    @Body() resource: ChangeEmailResource,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.changeEmail(new ChangeEmailCommand(userId, resource.newEmail));
    return this.requery(userId);
  }

  /**
   * Records the observed email confirmation (REGISTERED becomes ACTIVE).
   */
  @Post(':id/email/verifications')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async verifyEmail(
    @Param('id') id: string,
    @Body() resource: VerifyEmailResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.verifyEmail(new VerifyEmailCommand(userId, resource.email));
    response.location(`/api/v1/iam/users/${userId.value}/email`);
    return this.requery(userId);
  }

  /**
   * Links the single agreed outside proof.
   */
  @Post(':id/outside-identities')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Already linked or not active' })
  async linkOutside(
    @Param('id') id: string,
    @Body() resource: LinkOutsideIdentityResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.linkOutsideIdentity(
      new LinkOutsideIdentityCommand(userId, resource.provider, resource.externalId),
    );
    response.location(`/api/v1/iam/users/${userId.value}/outside-identities/${resource.provider}`);
    return this.requery(userId);
  }

  /**
   * Unlinks the outside proof (refused when final way to prove).
   */
  @Delete(':id/outside-identities/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Outside proof unlinked' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Last proof refused' })
  async unlinkOutside(
    @Param('id') id: string,
    @Param('provider') provider: string,
  ): Promise<void> {
    await this.commands.unlinkOutsideIdentity(
      new UnlinkOutsideIdentityCommand(this.toUserId(id), provider),
    );
  }

  /**
   * Grants a global technical system role.
   */
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role already held' })
  async grantRole(
    @Param('id') id: string,
    @Body() resource: GrantRoleResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    await this.commands.grantSystemRole(new GrantSystemRoleCommand(userId, parseSystemRole(resource.role)));
    response.location(`/api/v1/iam/users/${userId.value}/roles/${resource.role}`);
    return this.requery(userId);
  }

  /**
   * Revokes a held role (final ADMIN refused as invariant).
   */
  @Delete(':id/roles/:role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Role revoked' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role not held or last admin' })
  async revokeRole(
    @Param('id') id: string,
    @Param('role') role: string,
  ): Promise<void> {
    await this.commands.revokeSystemRole(
      new RevokeSystemRoleCommand(this.toUserId(id), parseSystemRole(role)),
    );
  }

  /**
   * Moves the identity to the desired standing. The body carries state,
   * not an action: the server still judges the transition and refuses
   * illegal ones (422) or a missing suspend reason (422).
   */
  @Patch(':id/standing')
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async updateStanding(
    @Param('id') id: string,
    @Body() resource: StandingUpdateResource,
  ): Promise<UserResource> {
    const userId = this.toUserId(id);
    if (resource.standing === 'SUSPENDED')
      await this.commands.suspendAccess(new SuspendAccessCommand(userId, this.requireReason(resource.reason)));
    else await this.commands.restoreAccess(new RestoreAccessCommand(userId));
    return this.requery(userId);
  }

  /**
   * Parses an identity path string or raises the read rejection.
   * @param id Raw user id string.
   */
  private toUserId(id: string): UserId {
    try {
      return UserId.of(id);
    } catch {
      throw new UserNotFoundError('user not found');
    }
  }

  /**
   * Requires a recorded reason for suspension.
   * @param reason Raw reason string.
   */
  private requireReason(reason: string | undefined): string {
    if (!reason?.trim()) throw new IllegalUserStateError('reason required');
    return reason;
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
