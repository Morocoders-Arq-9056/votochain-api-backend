import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GetVerifiableProofByVoteQuery } from '../../../domain/model/queries/get-verifiable-proof-by-vote.query.js';
import { GetVoterReceiptByProposalAndVoterQuery } from '../../../domain/model/queries/get-voter-receipt-by-proposal-and-voter.query.js';
import { VOTE_COMMAND_SERVICE, type VoteCommandService } from '../../../domain/services/vote-command.service.js';
import { VOTE_QUERY_SERVICE, type VoteQueryService } from '../../../domain/services/vote-query.service.js';
import { CastVoteResource } from '../resources/cast-vote.resource.js';
import { ProofResource } from '../resources/proof.resource.js';
import { VoteReceiptResource } from '../resources/vote-receipt.resource.js';
import { VotingExceptionFilter } from '../filters/voting-exception.filter.js';
import { CastVoteCommandFromResourceAssembler } from '../transform/cast-vote-command-from-resource.assembler.js';
import { VotingParamsAssembler } from '../transform/voting-params.assembler.js';
import { VotingResourceFromEntityAssembler } from '../transform/voting-resource-from-entity.assembler.js';

/**
 * Thin inbound adapter for votes: UC4 cast (idempotent by Idempotency-Key),
 * verifiable proof and voter receipt reads.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@ApiTags('votes')
@Controller('votes')
@UseFilters(VotingExceptionFilter)
export class VotesController {
  constructor(
    @Inject(VOTE_COMMAND_SERVICE) private readonly commands: VoteCommandService,
    @Inject(VOTE_QUERY_SERVICE) private readonly queries: VoteQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: VoteReceiptResource })
  async castVote(
    @Body() resource: CastVoteResource,
    @Headers('idempotency-key') key: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VoteReceiptResource> {
    // Presence validation lives here: IdempotencyInterceptor only extracts the
    // configured header onto the request, it never rejects a missing key.
    if (!key?.trim()) throw new BadRequestException('Idempotency-Key required');
    const { voteId } = await this.commands.castVoteIdempotent(
      CastVoteCommandFromResourceAssembler.toCommandFromResource(resource), key);
    const proof = await this.queries.getVerifiableProofByVote(new GetVerifiableProofByVoteQuery(voteId));
    if (!proof) throw new NotFoundException();
    const receipt = VotingResourceFromEntityAssembler.toReceiptResourceFromProof(proof);
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/votes/${voteId.value}`);
    return receipt;
  }

  @Get('receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VoteReceiptResource })
  @ApiNotFoundResponse({ description: 'Unknown vote' })
  async getReceipt(@Query('proposal') proposal: string, @Query('voter') voter: string): Promise<VoteReceiptResource> {
    const receipt = await this.queries.getVoterReceiptByProposalAndVoter(
      new GetVoterReceiptByProposalAndVoterQuery(VotingParamsAssembler.toProposalId(proposal),
        VotingParamsAssembler.toVoterAddress(voter)));
    if (!receipt) throw new NotFoundException();
    return VotingResourceFromEntityAssembler.toReceiptResource(receipt);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProofResource })
  @ApiNotFoundResponse({ description: 'Unknown vote' })
  async getProof(@Param('id') id: string): Promise<ProofResource> {
    const proof = await this.queries.getVerifiableProofByVote(
      new GetVerifiableProofByVoteQuery(VotingParamsAssembler.toVoteId(id)));
    if (!proof) throw new NotFoundException();
    return VotingResourceFromEntityAssembler.toProofResource(proof);
  }
}
