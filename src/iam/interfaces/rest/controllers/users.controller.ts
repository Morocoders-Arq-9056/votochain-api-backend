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
import { ChangeEmailResource, VerifyEmailResource } from '../resources/change-email.resource.js';
import { StandingUpdateResource } from '../resources/standing-update.resource.js';
import { ChangeSecretResource, LinkOutsideIdentityResource } from '../resources/outside-identity.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { SignUpCommandFromResourceAssembler } from '../transform/sign-up-command-from-resource.assembler.js';
import { ChangeSecretCommand } from '../../../domain/model/commands/change-secret.command.js';
import { ChangeEmailCommand } from '../../../domain/model/commands/change-email.command.js';
import { VerifyEmailCommand } from '../../../domain/model/commands/verify-email.command.js';
import { LinkOutsideIdentityCommand } from '../../../domain/model/commands/link-outside-identity.command.js';
import { UnlinkOutsideIdentityCommand } from '../../../domain/model/commands/unlink-outside-identity.command.js';
import { SuspendAccessCommand } from '../../../domain/model/commands/suspend-access.command.js';
import { RestoreAccessCommand } from '../../../domain/model/commands/restore-access.command.js';
import { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
import { IllegalUserStateError } from '../../../domain/exceptions/illegal-user-state.error.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for the identity itself: registration, reads,
 * contact facts, and standing. Sessions (how identity is proven) live in
 * `AuthenticationController`; grants (what identity may do) live in
 * `AuthorizationController`.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('users')
@Controller('users')
@UseFilters(IamExceptionFilter)
export class UsersController {
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
    response.location(`/api/v1/users/${userId.value}`);
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
    response.location(`/api/v1/users/${userId.value}/email`);
    return this.requery(userId);
  }

  /**
   * Links a proof factor to the account.
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
    response.location(`/api/v1/users/${userId.value}/outside-identities/${resource.provider}`);
    return this.requery(userId);
  }

  /**
   * Lists the proof factors linked to the account (at most one in Sprint-01).
   */
  @Get(':id/outside-identities')
  @ApiOkResponse({ description: 'Linked outside proof factors' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async listOutside(@Param('id') id: string): Promise<{ provider: string }[]> {
    const user = await this.requery(this.toUserId(id));
    return user.outsideProver ? [{ provider: user.outsideProver }] : [];
  }

  /**
   * Unlinks a proof factor (refused when final way to prove).
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
   * Moves the identity to the desired standing. The body carries state,
   * not an action: the server still judges the transition and refuses
   * illegal ones (422) or a missing suspend reason (422).
   */  @Patch(':id/standing')
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
