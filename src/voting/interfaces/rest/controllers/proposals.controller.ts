import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GetProposalByIdQuery } from '../../../domain/model/queries/get-proposal-by-id.query.js';
import { GetTallyByProposalQuery } from '../../../domain/model/queries/get-tally-by-proposal.query.js';
import { ListProposalsByCommunityAndStatusQuery } from '../../../domain/model/queries/list-proposals-by-community-and-status.query.js';
import { Proposal } from '../../../domain/model/aggregates/proposal.aggregate.js';
import type { ProposalId } from '../../../domain/model/valueobjects/proposal-id.value-object.js';
import { PROPOSAL_COMMAND_SERVICE, type ProposalCommandService } from '../../../domain/services/proposal-command.service.js';
import { PROPOSAL_QUERY_SERVICE, type ProposalQueryService } from '../../../domain/services/proposal-query.service.js';
import { DraftProposalResource } from '../resources/draft-proposal.resource.js';
import { ProposalResource } from '../resources/proposal.resource.js';
import { TallyResource } from '../resources/tally.resource.js';
import { VotingExceptionFilter } from '../filters/voting-exception.filter.js';
import { DraftProposalCommandFromResourceAssembler } from '../transform/draft-proposal-command-from-resource.assembler.js';
import { ProposalCommandFromParamAssembler } from '../transform/proposal-command-from-param.assembler.js';
import { VotingParamsAssembler } from '../transform/voting-params.assembler.js';
import { VotingResourceFromEntityAssembler } from '../transform/voting-resource-from-entity.assembler.js';

/**
 * Thin inbound adapter for proposals: UC1 draft, UC2 open, UC7 close,
 * detail, community listing and tally reads.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@ApiTags('proposals')
@Controller('proposals')
@UseFilters(VotingExceptionFilter)
export class ProposalsController {
  constructor(
    @Inject(PROPOSAL_COMMAND_SERVICE) private readonly commands: ProposalCommandService,
    @Inject(PROPOSAL_QUERY_SERVICE) private readonly queries: ProposalQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProposalResource })
  async draftProposal(@Body() resource: DraftProposalResource, @Res({ passthrough: true }) response: Response): Promise<ProposalResource> {
    const id = await this.commands.draftProposal(DraftProposalCommandFromResourceAssembler.toCommandFromResource(resource));
    response.location(`/${this.prefix()}/proposals/${id.value}`);
    return this.requery(id);
  }

  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProposalResource })
  @ApiNotFoundResponse({ description: 'Unknown proposal' })
  async openProposal(@Param('id') id: string): Promise<ProposalResource> {
    const command = ProposalCommandFromParamAssembler.toOpenProposalCommand(id);
    await this.commands.openProposal(command);
    return this.requery(command.proposalId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProposalResource })
  @ApiNotFoundResponse({ description: 'Unknown proposal' })
  async closeProposal(@Param('id') id: string): Promise<ProposalResource> {
    const command = ProposalCommandFromParamAssembler.toCloseProposalCommand(id);
    await this.commands.closeProposal(command);
    return this.requery(command.proposalId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProposalResource })
  @ApiNotFoundResponse({ description: 'Unknown proposal' })
  async getProposal(@Param('id') id: string): Promise<ProposalResource> {
    return this.requery(VotingParamsAssembler.toProposalId(id));
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ProposalResource] })
  async listProposals(@Query('communityId') communityId: string, @Query('status') status?: string): Promise<ProposalResource[]> {
    const proposals = await this.queries.listProposalsByCommunityAndStatus(
      new ListProposalsByCommunityAndStatusQuery(VotingParamsAssembler.toCommunityId(communityId),
        status ? VotingParamsAssembler.toProposalStatus(status) : null));
    return proposals.map((p) => VotingResourceFromEntityAssembler.toProposalResource(p));
  }

  @Get(':id/tally')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TallyResource })
  @ApiNotFoundResponse({ description: 'Unknown proposal or tally' })
  async getTally(@Param('id') id: string): Promise<TallyResource> {
    const proposalId = VotingParamsAssembler.toProposalId(id);
    const tally = await this.queries.getTallyByProposal(new GetTallyByProposalQuery(proposalId));
    if (!tally) throw new NotFoundException();
    return VotingResourceFromEntityAssembler.toTallyResource(id, tally.toRecord(), tally.turnout, tally.quorumMet);
  }

  @Post(':id/tally')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProposalResource })
  async tallyProposal(@Param('id') id: string): Promise<ProposalResource> {
    const command = ProposalCommandFromParamAssembler.toTallyProposalCommand(id);
    await this.commands.tallyProposal(command);
    return this.requery(command.proposalId);
  }

  private prefix(): string {
    return this.config.get<string>('app.prefix', 'api/v1');
  }

  private async requery(proposalId: ProposalId): Promise<ProposalResource> {
    const proposal: Proposal | null = await this.queries.getProposalById(new GetProposalByIdQuery(proposalId));
    if (!proposal) throw new NotFoundException();
    return VotingResourceFromEntityAssembler.toProposalResource(proposal);
  }
}
