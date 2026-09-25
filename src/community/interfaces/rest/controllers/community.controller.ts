import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Put, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { COMMUNITY_COMMAND_SERVICE } from '../../../domain/services/community-command.service.js';
import type { CommunityCommandService } from '../../../domain/services/community-command.service.js';
import { COMMUNITY_QUERY_SERVICE } from '../../../domain/services/community-query.service.js';
import type { CommunityQueryService } from '../../../domain/services/community-query.service.js';
import { ActivateCommunityCommand } from '../../../domain/model/commands/activate-community.command.js';
import { ReactivateCommunityCommand } from '../../../domain/model/commands/reactivate-community.command.js';
import { RemoveCommunityAdminCommand } from '../../../domain/model/commands/remove-community-admin.command.js';
import { GetAdministratorsByCommunityQuery } from '../../../domain/model/queries/get-administrators-by-community.query.js';
import { GetCommunityByIdQuery } from '../../../domain/model/queries/get-community-by-id.query.js';
import { GetStandingByCommunityQuery } from '../../../domain/model/queries/get-standing-by-community.query.js';
import { GetVotingPolicyByCommunityQuery } from '../../../domain/model/queries/get-voting-policy-by-community.query.js';
import { Community } from '../../../domain/model/aggregates/community.aggregate.js';
import { CommunityId } from '../../../domain/model/valueobjects/community-id.value-object.js';
import { RegisterCommunityResource } from '../resources/register-community.resource.js';
import { UpdateCommunitySettingsResource } from '../resources/update-community-settings.resource.js';
import { DefinePolicyResource } from '../resources/define-policy.resource.js';
import { ReasonResource } from '../resources/reason.resource.js';
import { AppointAdminResource } from '../resources/appoint-admin.resource.js';
import { CommunityResource } from '../resources/community.resource.js';
import { CommunityStandingResource } from '../resources/community-standing.resource.js';
import { PolicyAnswerResource } from '../resources/policy-answer.resource.js';
import { AdminResource } from '../resources/admin.resource.js';
import { CommunityParamsAssembler } from '../transform/community-params.assembler.js';
import { RegisterCommunityCommandFromResourceAssembler } from '../transform/register-community-command-from-resource.assembler.js';
import { UpdateCommunitySettingsCommandFromResourceAssembler } from '../transform/update-settings-command-from-resource.assembler.js';
import { DefineVotingPolicyCommandFromResourceAssembler } from '../transform/define-policy-command-from-resource.assembler.js';
import { AppointCommunityAdminCommandFromResourceAssembler } from '../transform/appoint-admin-command-from-resource.assembler.js';
import { ReasonCommandFromResourceAssembler } from '../transform/reason-command-from-resource.assembler.js';
import { CommunityResourceFromEntityAssembler } from '../transform/community-resource-from-entity.assembler.js';
import { CommunityExceptionFilter } from '../filters/community-exception.filter.js';

/**
 * Thin inbound adapter for the Community Management bounded context.
 *
 * Maps validated resources to command/query objects and delegates to the
 * service tokens; re-queries after writes to rebuild the response (accepted
 * CQRS round-trip). Holds no business rules. Domain rejections surface
 * through {@link CommunityExceptionFilter}.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@ApiTags('communities')
@Controller('communities')
@UseFilters(CommunityExceptionFilter)
export class CommunityController {
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
   * Activates a REGISTERED community once policy and admin are in place.
   */
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Illegal transition or missing policy' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async activateCommunity(@Param('id') id: string): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.activateCommunity(new ActivateCommunityCommand(communityId));
    return this.requery(communityId);
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
   * Defines a new voting policy version, superseding the previous.
   */
  @Put(':id/policy')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Archived is terminal' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async definePolicy(
    @Param('id') id: string,
    @Body() resource: DefinePolicyResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.defineVotingPolicy(
      DefineVotingPolicyCommandFromResourceAssembler.toCommand(id, resource),
    );
    return this.requery(communityId);
  }

  /**
   * Entrusts a person as administrator after the IAM existence gate.
   */
  @Post(':id/admins')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Already appointed or archived' })
  @ApiNotFoundResponse({ description: 'Unknown community or person' })
  async appointAdmin(
    @Param('id') id: string,
    @Body() resource: AppointAdminResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.appointCommunityAdmin(
      AppointCommunityAdminCommandFromResourceAssembler.toCommand(id, resource),
    );
    return this.requery(communityId);
  }

  /**
   * Removes an administrator; the last one while ACTIVE is refused.
   */
  @Delete(':id/admins/:personId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Last administrator while active' })
  @ApiNotFoundResponse({ description: 'Unknown community or admin' })
  async removeAdmin(
    @Param('id') id: string,
    @Param('personId') personId: string,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.removeCommunityAdmin(
      new RemoveCommunityAdminCommand(communityId, CommunityParamsAssembler.toPersonId(personId)),
    );
    return this.requery(communityId);
  }

  /**
   * Suspends an ACTIVE community with a recorded reason.
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Illegal transition' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async suspendCommunity(
    @Param('id') id: string,
    @Body() resource: ReasonResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.suspendCommunity(
      ReasonCommandFromResourceAssembler.toSuspendCommand(id, resource),
    );
    return this.requery(communityId);
  }

  /**
   * Reactivates a SUSPENDED community once the cause is resolved.
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Illegal transition' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async reactivateCommunity(@Param('id') id: string): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.reactivateCommunity(new ReactivateCommunityCommand(communityId));
    return this.requery(communityId);
  }

  /**
   * Archives an ACTIVE or SUSPENDED community. Terminal.
   */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CommunityResource })
  @ApiConflictResponse({ description: 'Illegal transition' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async archiveCommunity(
    @Param('id') id: string,
    @Body() resource: ReasonResource,
  ): Promise<CommunityResource> {
    const communityId = CommunityParamsAssembler.toCommunityId(id);
    await this.commands.archiveCommunity(
      ReasonCommandFromResourceAssembler.toArchiveCommand(id, resource),
    );
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
   * Answers the current voting policy once defined.
   */
  @Get(':id/policy')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PolicyAnswerResource })
  @ApiUnprocessableEntityResponse({ description: 'Policy undefined' })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async getPolicy(@Param('id') id: string): Promise<PolicyAnswerResource> {
    const policy = await this.queries.getVotingPolicyByCommunity(
      new GetVotingPolicyByCommunityQuery(CommunityParamsAssembler.toCommunityId(id)),
    );
    return new PolicyAnswerResource(policy.threshold, policy.basis, policy.majorityRule);
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
   * Lists the entrusted administrators of the community.
   */
  @Get(':id/admins')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AdminResource] })
  @ApiNotFoundResponse({ description: 'Unknown community' })
  async getAdmins(@Param('id') id: string): Promise<AdminResource[]> {
    const community = await this.requeryEntity(CommunityParamsAssembler.toCommunityId(id));
    return CommunityResourceFromEntityAssembler.toAdminResources(community);
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
