import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Put, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { COMMUNITY_COMMAND_SERVICE } from '../../../domain/services/community-command.service.js';
import type { CommunityCommandService } from '../../../domain/services/community-command.service.js';
import { COMMUNITY_QUERY_SERVICE } from '../../../domain/services/community-query.service.js';
import type { CommunityQueryService } from '../../../domain/services/community-query.service.js';
import { GetCommunityByIdQuery } from '../../../domain/model/queries/get-community-by-id.query.js';
import { GetVotingPolicyByCommunityQuery } from '../../../domain/model/queries/get-voting-policy-by-community.query.js';
import { CommunityId } from '../../../domain/model/valueobjects/community-id.value-object.js';
import { DefinePolicyResource } from '../resources/define-policy.resource.js';
import { CommunityResource } from '../resources/community.resource.js';
import { PolicyAnswerResource } from '../resources/policy-answer.resource.js';
import { CommunityParamsAssembler } from '../transform/community-params.assembler.js';
import { DefineVotingPolicyCommandFromResourceAssembler } from '../transform/define-policy-command-from-resource.assembler.js';
import { CommunityResourceFromEntityAssembler } from '../transform/community-resource-from-entity.assembler.js';
import { CommunityExceptionFilter } from '../filters/community-exception.filter.js';

/**
 * Thin inbound adapter for the participation rule: the quorum threshold,
 * basis, and majority rule Voting freezes per proposal opening.
 * Each definition supersedes the previous; frozen copies stay untouched.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('policies')
@Controller('communities/:id/policy')
@UseFilters(CommunityExceptionFilter)
export class PoliciesController {
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
   * Defines a new voting policy version, superseding the previous.
   */
  @Put()
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
    const community = await this.queries.getCommunityById(new GetCommunityByIdQuery(communityId));
    if (!community) throw new NotFoundException();
    return CommunityResourceFromEntityAssembler.toResourceFromEntity(community);
  }

  /**
   * Answers the current voting policy once defined.
   */
  @Get()
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
   * Re-reads the saved aggregate or raises not-found.
   * @param communityId Community just written.
   */
  private async requeryEntity(communityId: CommunityId) {
    const community = await this.queries.getCommunityById(new GetCommunityByIdQuery(communityId));
    if (!community) throw new NotFoundException();
    return community;
  }
}
