import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { GetSystemRolesByPersonQuery } from '../../../domain/model/queries/get-system-roles-by-person.query.js';
import { UserResource } from '../resources/user.resource.js';
import { GrantRoleResource } from '../resources/system-role.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { IamParamsAssembler } from '../transform/iam-params.assembler.js';
import { GrantSystemRoleCommand } from '../../../domain/model/commands/grant-system-role.command.js';
import { RevokeSystemRoleCommand } from '../../../domain/model/commands/revoke-system-role.command.js';
import type { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
import { IamExceptionFilter } from '../filters/iam-exception.filter.js';

/**
 * Thin inbound adapter for identity grants: system roles.
 * Answers *what identity may do*; the identity itself lives in
 * `UsersController`, proof lives in `AuthenticationController`.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('authorization')
@Controller('users/:id/roles')
@UseFilters(IamExceptionFilter)
export class AuthorizationController {
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
   * Lists the system roles held by the identity.
   */
  @Get()
  @ApiOkResponse({ type: [String] })
  @ApiNotFoundResponse({ description: 'User not found' })
  async listRoles(@Param('id') id: string): Promise<string[]> {
    const userId = IamParamsAssembler.toUserId(id);
    const user = await this.queries.getUserById(new GetUserByIdQuery(userId));
    if (!user) throw new NotFoundException();
    return this.queries.getSystemRolesByPerson(new GetSystemRolesByPersonQuery(user.personId));
  }

  /**
   * Grants a global technical system role.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResource })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role already held' })
  async grantRole(
    @Param('id') id: string,
    @Body() resource: GrantRoleResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResource> {
    const userId = IamParamsAssembler.toUserId(id);
    await this.commands.grantSystemRole(new GrantSystemRoleCommand(userId, IamParamsAssembler.toSystemRole(resource.role)));
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/users/${userId.value}/roles/${resource.role}`);
    return this.requery(userId);
  }

  /**
   * Revokes a held role (final ADMIN refused as invariant).
   */
  @Delete(':role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Role revoked' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Role not held or last admin' })
  async revokeRole(
    @Param('id') id: string,
    @Param('role') role: string,
  ): Promise<void> {
    await this.commands.revokeSystemRole(
      new RevokeSystemRoleCommand(IamParamsAssembler.toUserId(id), IamParamsAssembler.toSystemRole(role)),
    );
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
