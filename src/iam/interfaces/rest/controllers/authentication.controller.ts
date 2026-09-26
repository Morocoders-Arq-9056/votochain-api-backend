import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { UserResource } from '../resources/user.resource.js';
import { SignInResource } from '../resources/sign-in.resource.js';
import { LinkOutsideIdentityResource } from '../resources/outside-identity.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { SignInCommand } from '../../../domain/model/commands/sign-in.command.js';
import { SignOutCommand } from '../../../domain/model/commands/sign-out.command.js';
import { LinkOutsideIdentityCommand } from '../../../domain/model/commands/link-outside-identity.command.js';
import { UnlinkOutsideIdentityCommand } from '../../../domain/model/commands/unlink-outside-identity.command.js';
import { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
import { parseProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for proving identity: sessions and outside factors.
 * Answers *how identity is proven*; the identity itself lives in
 * `UsersController`, grants live in `AuthorizationController`.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('authentication')
@Controller('users/:id')
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
   * Opens the single session, superseding any prior one.
   */
  @Post('sessions')
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
    response.location(`/api/v1/users/${userId.value}/sessions/current`);
    return this.requery(userId);
  }

  /**
   * Closes the open session.
   */
  @Delete('sessions/current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Session closed' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'No open session' })
  async signOut(@Param('id') id: string): Promise<void> {
    await this.commands.signOut(new SignOutCommand(this.toUserId(id)));
  }

  /**
   * Links the single agreed outside proof factor.
   */
  @Post('outside-identities')
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
   * Unlinks the outside proof factor (refused when final way to prove).
   */
  @Delete('outside-identities/:provider')
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
   * Re-reads the saved aggregate to rebuild the response resource.
   * @param userId Identity just written.
   */
  private async requery(userId: UserId): Promise<UserResource> {
    const user = await this.queries.getUserById(new GetUserByIdQuery(userId));
    if (!user) throw new NotFoundException();
    return UserResourceFromEntityAssembler.toResourceFromEntity(user);
  }
}
