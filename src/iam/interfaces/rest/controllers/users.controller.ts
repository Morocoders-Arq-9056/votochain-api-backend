import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { ChangeSecretCommandFromResourceAssembler } from '../transform/change-secret-command-from-resource.assembler.js';
import { ChangeEmailCommandFromResourceAssembler } from '../transform/change-email-command-from-resource.assembler.js';
import { VerifyEmailCommandFromResourceAssembler } from '../transform/verify-email-command-from-resource.assembler.js';
import { LinkOutsideIdentityCommandFromResourceAssembler } from '../transform/link-outside-identity-command-from-resource.assembler.js';
import { UnlinkOutsideIdentityCommandFromResourceAssembler } from '../transform/unlink-outside-identity-command-from-resource.assembler.js';
import { IamParamsAssembler } from '../transform/iam-params.assembler.js';
import { SuspendAccessCommand } from '../../../domain/model/commands/suspend-access.command.js';
import { RestoreAccessCommand } from '../../../domain/model/commands/restore-access.command.js';
import type { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
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
   * @param config Reads the global API prefix for Location headers.
   */
  constructor(
    @Inject(USER_COMMAND_SERVICE) private readonly commands: UserCommandService,
    @Inject(USER_QUERY_SERVICE) private readonly queries: UserQueryService,
    private readonly config: ConfigService,
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
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/users/${userId.value}`);
    return this.requery(userId);
  }

  /**
   * Returns the identity.
   */
  @Get(':id')
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUser(@Param('id') id: string): Promise<UserResource> {
    return this.requery(IamParamsAssembler.toUserId(id));
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
    const userId = IamParamsAssembler.toUserId(id);
    await this.commands.changeSecret(ChangeSecretCommandFromResourceAssembler.toCommand(id, resource));
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
    const userId = IamParamsAssembler.toUserId(id);
    await this.commands.changeEmail(ChangeEmailCommandFromResourceAssembler.toCommand(id, resource));
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
    const userId = IamParamsAssembler.toUserId(id);
    await this.commands.verifyEmail(VerifyEmailCommandFromResourceAssembler.toCommand(id));
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/users/${userId.value}/email`);
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
    const userId = IamParamsAssembler.toUserId(id);
    await this.commands.linkOutsideIdentity(
      LinkOutsideIdentityCommandFromResourceAssembler.toCommand(id, resource),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/users/${userId.value}/outside-identities/${resource.provider}`);
    return this.requery(userId);
  }

  /**
   * Lists the proof factors linked to the account (at most one in Sprint-01).
   */
  @Get(':id/outside-identities')
  @ApiOkResponse({ description: 'Linked outside proof factors' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async listOutside(@Param('id') id: string): Promise<{ provider: string }[]> {
    const user = await this.requery(IamParamsAssembler.toUserId(id));
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
      UnlinkOutsideIdentityCommandFromResourceAssembler.toCommand(id, provider),
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
    const userId = IamParamsAssembler.toUserId(id);
    if (resource.standing === 'SUSPENDED')
      await this.commands.suspendAccess(new SuspendAccessCommand(userId, IamParamsAssembler.toReason(resource.reason)));
    else await this.commands.restoreAccess(new RestoreAccessCommand(userId));
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
