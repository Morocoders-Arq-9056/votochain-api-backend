import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { COMMUNITY_COMMAND_SERVICE } from '../../../domain/services/community-command.service.js';
import type { CommunityCommandService } from '../../../domain/services/community-command.service.js';
import { COMMUNITY_QUERY_SERVICE } from '../../../domain/services/community-query.service.js';
import type { CommunityQueryService } from '../../../domain/services/community-query.service.js';
import { ActivateCommunityCommand } from '../../../domain/model/commands/activate-community.command.js';
import { ArchiveCommunityCommand } from '../../../domain/model/commands/archive-community.command.js';
import { ReactivateCommunityCommand } from '../../../domain/model/commands/reactivate-community.command.js';
import { SuspendCommunityCommand } from '../../../domain/model/commands/suspend-community.command.js';
import { GetCommunityByIdQuery } from '../../../domain/model/queries/get-community-by-id.query.js';
import { GetStandingByCommunityQuery } from '../../../domain/model/queries/get-standing-by-community.query.js';
import { Community } from '../../../domain/model/aggregates/community.aggregate.js';
import { CommunityId } from '../../../domain/model/valueobjects/community-id.value-object.js';
import { CommunityStanding, parseCommunityStanding } from '../../../domain/model/valueobjects/community-standing.value-object.js';
import { IllegalCommunityTransitionError } from '../../../domain/exceptions/illegal-community-transition.error.js';
import { RegisterCommunityResource } from '../resources/register-community.resource.js';
import { UpdateCommunitySettingsResource } from '../resources/update-community-settings.resource.js';
import { StandingUpdateResource } from '../resources/standing-update.resource.js';
import { CommunityResource } from '../resources/community.resource.js';
import { CommunityStandingResource } from '../resources/community-standing.resource.js';
import { CommunityParamsAssembler } from '../transform/community-params.assembler.js';
import { RegisterCommunityCommandFromResourceAssembler } from '../transform/register-community-command-from-resource.assembler.js';
import { UpdateCommunitySettingsCommandFromResourceAssembler } from '../transform/update-settings-command-from-resource.assembler.js';
import { CommunityResourceFromEntityAssembler } from '../transform/community-resource-from-entity.assembler.js';
import { CommunityExceptionFilter } from '../filters/community-exception.filter.js';

/**
 * Thin inbound adapter for the community itself: registration, reads,
 * settings, and standing. The participation rule lives in
 * `PoliciesController`; administrators live in `AdminsController`
 * (domain invariant 4: administration, configuration, and standing
 * evolve independently).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('communities')
@Controller('communities')
@UseFilters(CommunityExceptionFilter)
export class CommunitiesController {
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
   * Registers a fresh community with its founding administrator.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Name already held by a live community' })
  async registerCommunity(
    @Body() resource: RegisterCommunityResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommunityResource> {
    const communityId = await this.commands.registerCommunity(
      RegisterCommunityCommandFromResourceAssembler.toCommandFromResource(resource),
    );
    response.location(`/api/v1/communities/${communityId.value}`);
    return this.requery(communityId);
  }

  /**
   * Returns the community or nothing.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async getCommunity(@Param('id') id: string): Promise<CommunityResource> {
    return this.requery(CommunityParamsAssembler.toCommunityId(id));
  }

  /**
   * Updates the community facts without touching standing history.
   */
  @Patch(':id/settings')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Archived is terminal' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async updateSettings(
    @Param('id') id: string,
    @Body() resource: UpdateCommunitySettingsResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.updateCommunitySettings(
      UpdateCommunitySettingsCommandFromResourceAssembler.toCommand(id, resource),
    );
    return this.requery(communityId);
  }

  /**
   * Moves the community to the desired standing. The body carries state,
   * not an action: the server judges the transition and refuses illegal
   * ones (409) or missing reasons for suspend/archive (409).
   */
  @Patch(':id/standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Illegal transition or reason required' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async updateStanding(
    @Param('id') id: string,
    @Body() resource: StandingUpdateResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    const standing = parseCommunityStanding(resource.standing);
    const current = (
      await this.queries.getStandingByCommunity(new GetStandingByCommunityQuery(communityId))
    ).standing;
    switch (standing) {
      case CommunityStanding.ACTIVE:
        if (current === CommunityStanding.SUSPENDED)
          await this.commands.reactivateCommunity(new ReactivateCommunityCommand(communityId));
        else await this.commands.activateCommunity(new ActivateCommunityCommand(communityId));
        break;
      case CommunityStanding.SUSPENDED:
        await this.commands.suspendCommunity(
          new SuspendCommunityCommand(communityId, this.requireReason(resource.reason)),
        );
        break;
      case CommunityStanding.ARCHIVED:
        await this.commands.archiveCommunity(
          new ArchiveCommunityCommand(communityId, this.requireReason(resource.reason)),
        );
        break;
      default:
        throw new IllegalCommunityTransitionError('cannot transition to REGISTERED');
    }
    return this.requery(communityId);
  }

  /**
   * Requires a recorded reason for suspend/archive transitions.
   * @param reason Raw reason string.
   */
  private requireReason(reason: string | undefined): string {
    if (!reason?.trim()) throw new IllegalCommunityTransitionError('reason required');
    return reason;
  }

  /**
   * Answers the standing question: standing plus acceptance (UC10, no facts).
   */
  @Get(':id/standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityStandingResource })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async getStanding(@Param('id') id: string): Promise<CommunityStandingResource> {
    const answer = await this.queries.getStandingByCommunity(
      new GetStandingByCommunityQuery(CommunityParamsAssembler.toCommunityId(id)),
    );
    return new CommunityStandingResource(answer.standing, answer.acceptsMembers, answer.acceptsProposals);
  }

  /**
   * Re-reads the saved aggregate to rebuild the response resource.
   * @param communityId Community just written.
   */
  private async requery(communityId: CommunityId): Promise<CommunityResource> {
    return CommunityResourceFromEntityAssembler.toResourceFromEntity(await this.requeryEntity(communityId));
  }

  /**
   * Re-reads the saved aggregate or raises not-found.
   * @param communityId Community just written.
   */
  private async requeryEntity(communityId: CommunityId): Promise<Community> {
    const community: Community | null = await this.queries.getCommunityById(
      new GetCommunityByIdQuery(communityId),
    );
    if (!community) throw new NotFoundException();
    return community;
  }
}
