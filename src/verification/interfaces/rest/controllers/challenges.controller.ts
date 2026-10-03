import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { VERIFICATION_COMMAND_SERVICE } from '../../../domain/services/verification-command.service.js';
import type { VerificationCommandService } from '../../../domain/services/verification-command.service.js';
import { VERIFICATION_QUERY_SERVICE } from '../../../domain/services/verification-query.service.js';
import type { VerificationQueryService } from '../../../domain/services/verification-query.service.js';
import { GetChallengeByIdQuery } from '../../../domain/model/queries/get-challenge-by-id.query.js';
import { GetChallengeHistoryByPersonAndPurposeQuery } from '../../../domain/model/queries/get-challenge-history-by-person-and-purpose.query.js';
import { RequestChallengeResource } from '../resources/request-challenge.resource.js';
import { ChallengeResource } from '../resources/challenge.resource.js';
import { RequestVerificationChallengeCommandFromResourceAssembler } from '../transform/request-verification-challenge-command-from-resource.assembler.js';
import { VerificationParamsAssembler } from '../transform/verification-params.assembler.js';
import { ChallengeResourceFromEntityAssembler } from '../transform/challenge-resource-from-entity.assembler.js';
import { VerificationExceptionFilter } from '../filters/verification-exception.filter.js';

/**
 * Thin inbound adapter for the challenge lifecycle: request, read, list.
 * Judging presented codes lives in `AnswersController` — attempts are a
 * counted facet of the challenge (domain H2), so the lifecycle never splits,
 * only the code organization does.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('challenges')
@Controller('challenges')
@UseFilters(VerificationExceptionFilter)
export class ChallengesController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   * @param config Reads the global API prefix for Location headers.
   */
  constructor(
    @Inject(VERIFICATION_COMMAND_SERVICE) private readonly commands: VerificationCommandService,
    @Inject(VERIFICATION_QUERY_SERVICE) private readonly queries: VerificationQueryService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Opens a challenge for the pair, superseding the prior OPEN atomically.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ChallengeResource })
  @ApiUnprocessableEntityResponse({ description: 'Unknown purpose or contact not allowed' })
  async requestChallenge(
    @Body() resource: RequestChallengeResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChallengeResource> {
    const command = RequestVerificationChallengeCommandFromResourceAssembler.toCommandFromResource(resource);
    const challengeId = await this.commands.requestVerificationChallenge(command);
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/challenges/${challengeId.value}`);
    const challenge = await this.queries.getChallengeById(new GetChallengeByIdQuery(challengeId));
    if (!challenge) throw new NotFoundException();
    return ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge);
  }

  /**
   * Returns the challenge with its standing and remaining attempts.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChallengeResource })
  @ApiNotFoundResponse({ description: 'No usable challenge' })
  async getChallenge(@Param('id') id: string): Promise<ChallengeResource> {
    const challenge = await this.queries.getChallengeById(
      new GetChallengeByIdQuery(VerificationParamsAssembler.toChallengeId(id)),
    );
    if (!challenge) throw new NotFoundException();
    return ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge);
  }

  /**
   * Returns every persisted challenge for the pair, ordered by request time.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ChallengeResource] })
  async getChallenges(
    @Query('personId') personId: string,
    @Query('purpose') purpose: string,
  ): Promise<ChallengeResource[]> {
    if (!personId?.trim() || !purpose?.trim())
      throw new BadRequestException('personId and purpose are required');
    const challenges = await this.queries.getChallengeHistoryByPersonAndPurpose(
      new GetChallengeHistoryByPersonAndPurposeQuery(
        VerificationParamsAssembler.toPersonId(personId),
        VerificationParamsAssembler.toPurpose(purpose),
      ),
    );
    return challenges.map((challenge) => ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge));
  }
}
