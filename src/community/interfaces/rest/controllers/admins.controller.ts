import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { COMMUNITY_COMMAND_SERVICE } from '../../../domain/services/community-command.service.js';
import type { CommunityCommandService } from '../../../domain/services/community-command.service.js';
import { COMMUNITY_QUERY_SERVICE } from '../../../domain/services/community-query.service.js';
import type { CommunityQueryService } from '../../../domain/services/community-query.service.js';
import { RemoveCommunityAdminCommand } from '../../../domain/model/commands/remove-community-admin.command.js';
import { GetCommunityByIdQuery } from '../../../domain/model/queries/get-community-by-id.query.js';
import { CommunityId } from '../../../domain/model/valueobjects/community-id.value-object.js';
import { AppointAdminResource } from '../resources/appoint-admin.resource.js';
import { AdminResource } from '../resources/admin.resource.js';
import { CommunityResource } from '../resources/community.resource.js';
import { CommunityParamsAssembler } from '../transform/community-params.assembler.js';
import { AppointCommunityAdminCommandFromResourceAssembler } from '../transform/appoint-admin-command-from-resource.assembler.js';
import { CommunityResourceFromEntityAssembler } from '../transform/community-resource-from-entity.assembler.js';
import { CommunityExceptionFilter } from '../filters/community-exception.filter.js';

/**
 * Thin inbound adapter for the entrusted administrators: who administers
 * the community. Deliberately distinct from membership parts and from
 * system-wide grants (domain H4).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('admins')
@Controller('communities/:id/admins')
@UseFilters(CommunityExceptionFilter)
export class AdminsController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(COMMUNITY_COMMAND_SERVICE) private readonly commands: CommunityCommandService,
    @Inject(COMMUNITY_QUERY_SERVICE) private readonly queries: CommunityQueryService,
  ) {}

  /**
   * Entrusts a person as administrator after the IAM existence gate.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Already appointed or archived' })
  @ApiNotFoundResponse({ description: 'Unknown community or person' })
  async appointAdmin(
    @Param('id') id: string,
    @Body() resource: AppointAdminResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.appointCommunityAdmin(
      AppointCommunityAdminCommandFromResourceAssembler.toCommand(id, resource),
    );
    response.location(`/api/v1/communities/${communityId.value}/admins/${resource.personId}`);
    const community = await this.requeryEntity(communityId);
    return CommunityResourceFromEntityAssembler.toResourceFromEntity(community);
  }

  /**
   * Lists the entrusted administrators of the community.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AdminResource] })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async getAdmins(@Param('id') id: string): Promise<AdminResource[]> {
    const community = await this.requeryEntity(CommunityParamsAssembler.toCommunityId(id));
    return CommunityResourceFromEntityAssembler.toAdminResources(community);
  }

  /**
   * Removes an administrator; the last one while ACTIVE is refused.
   */
  @Delete(':personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Administrator removed' })
  @ApiConflictResponse({ description: 'Last administrator while active' })
  @ApiNotFoundResponse({ description: 'Unknown community or admin' })
  async removeAdmin(
    @Param('id') id: string,
    @Param('personId') personId: string,
  ): Promise<void> {
    await this.commands.removeCommunityAdmin(
      new RemoveCommunityAdminCommand(
        CommunityParamsAssembler.toCommunityId(id),
        CommunityParamsAssembler.toPersonId(personId),
      ),
    );
  }

  /**
   * Re-reads the saved aggregate or raises not-found.
   * @param communityId Community just written.
   */
  private async requeryEntity(communityId: CommunityId) {
    const community = await this.queries.getCommunityById(new GetCommunityByIdQuery(communityId));
    if (!community) throw new NotFoundException();
    return community;
  }
}
