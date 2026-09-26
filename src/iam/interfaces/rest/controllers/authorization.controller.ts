import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { USER_COMMAND_SERVICE } from '../../../domain/services/user-command.service.js';
import type { UserCommandService } from '../../../domain/services/user-command.service.js';
import { USER_QUERY_SERVICE } from '../../../domain/services/user-query.service.js';
import type { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { UserResource } from '../resources/user.resource.js';
import { GrantRoleResource } from '../resources/system-role.resource.js';
import { UserResourceFromEntityAssembler } from '../transform/user-resource-from-entity.assembler.js';
import { GrantSystemRoleCommand } from '../../../domain/model/commands/grant-system-role.command.js';
import { RevokeSystemRoleCommand } from '../../../domain/model/commands/revoke-system-role.command.js';
import { UserId } from '../../../domain/model/valueobjects/user-id.value-object.js';
import { parseSystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';
import { UserNotFoundError } from '../../../domain/exceptions/user-not-found.error.js';
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
   */
  constructor(
    @Inject(USER_COMMAND_SERVICE) private readonly commands: UserCommandService,
    @Inject(USER_QUERY_SERVICE) private readonly queries: UserQueryService,
  ) {}

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
    const userId = this.toUserId(id);
    await this.commands.grantSystemRole(new GrantSystemRoleCommand(userId, parseSystemRole(resource.role)));
    response.location(`/api/v1/users/${userId.value}/roles/${resource.role}`);
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
      new RevokeSystemRoleCommand(this.toUserId(id), parseSystemRole(role)),
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
