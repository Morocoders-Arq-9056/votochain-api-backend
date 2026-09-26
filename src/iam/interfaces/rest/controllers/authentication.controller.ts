import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Post, Res, UseFilters } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByEmailQuery } from '../../../domain/model/queries/get-user-by-email.query.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { UserResource } from '../resources/user.resource.js';
import { SignUpResource } from '../resources/sign-up.resource.js';
import { SignInResource } from '../resources/sign-in.resource.js';
import { SignOutResource } from '../resources/sign-out.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { SignUpCommandFromResourceAssembler } from '../transform/sign-up-command-from-resource.assembler.js';
import { SignInCommand } from '../../../domain/model/commands/sign-in.command.js';
import { SignOutCommand } from '../../../domain/model/commands/sign-out.command.js';
import { parseProofKind } from '../../../domain/model/valueobjects/proof-kind.value-object.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for authentication: sign-up, sign-in, sign-out.
 * Works from what callers actually know (address, observed proof): the
 * server resolves addresses into technical identities, so no caller ever
 * presents a user id it cannot know. Identity management lives in
 * `UsersController`, grants in `AuthorizationController`.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('authentication')
@Controller('auth')
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
  @Post('sign-up')
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
    const user = await this.queries.getUserById(new GetUserByIdQuery(userId));
    if (!user) throw new NotFoundException();
    return UserResourceFromEntityAssembler.toResourceFromEntity(user);
  }

  /**
   * Opens the single session, superseding any prior one.
   */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'Address held by nobody' })
  @ApiConflictResponse({ description: 'Suspended or proof not held' })
  async signIn(@Body() resource: SignInResource): Promise<UserResource> {
    const user = await this.requireByEmail(resource.email);
    await this.commands.signIn(new SignInCommand(user.id, parseProofKind(resource.proofKind)));
    const current = await this.queries.getUserById(new GetUserByIdQuery(user.id));
    if (!current) throw new NotFoundException();
    return UserResourceFromEntityAssembler.toResourceFromEntity(current);
  }

  /**
   * Closes the open session.
   */
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Session closed' })
  @ApiNotFoundResponse({ description: 'Address held by nobody' })
  @ApiConflictResponse({ description: 'No open session' })
  async signOut(@Body() resource: SignOutResource): Promise<void> {
    const user = await this.requireByEmail(resource.email);
    await this.commands.signOut(new SignOutCommand(user.id));
  }

  /**
   * Resolves a contact address into its identity or raises not-found.
   * @param email Raw contact address.
   */
  private async requireByEmail(email: string): Promise<User> {
    const user = await this.queries.getUserByEmail(new GetUserByEmailQuery(email));
    if (!user) throw new UserNotFoundError('user not found');
    return user;
  }
}
