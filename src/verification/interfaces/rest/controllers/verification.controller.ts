import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiGoneResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { VERIFICATION_COMMAND_SERVICE } from '../../../domain/services/verification-command.service.js';
import type { VerificationCommandService } from '../../../domain/services/verification-command.service.js';
import { VERIFICATION_QUERY_SERVICE } from '../../../domain/services/verification-query.service.js';
import type { VerificationQueryService } from '../../../domain/services/verification-query.service.js';
import { AnswerVerificationChallengeCommand } from '../../../domain/model/commands/answer-verification-challenge.command.js';
import { GetChallengeByIdQuery } from '../../../domain/model/queries/get-challenge-by-id.query.js';
import { GetChallengeHistoryByPersonAndPurposeQuery } from '../../../domain/model/queries/get-challenge-history-by-person-and-purpose.query.js';
import { GetChallengeStandingByPersonAndPurposeQuery } from '../../../domain/model/queries/get-challenge-standing-by-person-and-purpose.query.js';
import { ChallengeId } from '../../../domain/model/valueobjects/challenge-id.value-object.js';
import { ChallengeStanding } from '../../../domain/model/valueobjects/challenge-standing.value-object.js';
import { VerificationChallenge } from '../../../domain/model/aggregates/verification-challenge.aggregate.js';
import { RequestChallengeResource } from '../resources/request-challenge.resource.js';
import { AnswerChallengeResource } from '../resources/answer-challenge.resource.js';
import { ChallengeResource } from '../resources/challenge.resource.js';
import { ChallengeStandingResource } from '../resources/challenge-standing.resource.js';
import { RequestVerificationChallengeCommandFromResourceAssembler } from '../transform/request-verification-challenge-command-from-resource.assembler.js';
import { VerificationParamsAssembler } from '../transform/verification-params.assembler.js';
import { ChallengeResourceFromEntityAssembler } from '../transform/challenge-resource-from-entity.assembler.js';
import { VerificationExceptionFilter } from '../filters/verification-exception.filter.js';

/**
 * Thin inbound adapter for the Verification bounded context.
 *
 * Maps validated resources to command/query objects and delegates to the
 * service tokens; re-queries after writes to rebuild the response (accepted
 * CQRS round-trip). Holds no business rules. Domain rejections surface
 * through {@link VerificationExceptionFilter}.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@ApiTags('verifications')
@Controller('verifications')
@UseFilters(VerificationExceptionFilter)
export class VerificationController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(VERIFICATION_COMMAND_SERVICE) private readonly commands: VerificationCommandService,
    @Inject(VERIFICATION_QUERY_SERVICE) private readonly queries: VerificationQueryService,
  ) {}

  /**
   * Opens a challenge for the pair, superseding the prior OPEN atomically.
   */
  @Post('challenges')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ChallengeResource })
  @ApiUnprocessableEntityResponse({ description: 'Unknown purpose or contact not allowed' })
  async requestChallenge(
    @Body() resource: RequestChallengeResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChallengeResource> {
    const command = RequestVerificationChallengeCommandFromResourceAssembler.toCommandFromResource(resource);
    const challengeId = await this.commands.requestVerificationChallenge(command);
    response.location(`/api/v1/verifications/challenges/${challengeId.value}`);
    return this.requery(challengeId);
  }

  /**
   * Judges one presented code: confirms, counts, or consumes the challenge.
   * Still OPEN after answering → 409 with remaining; consumed → 409 with
   * reason; window elapsed → 410 gone.
   */
  @Post('challenges/:id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChallengeResource })
  @ApiConflictResponse({ description: 'Attempts remain or challenge consumed' })
  @ApiGoneResponse({ description: 'Validity window elapsed' })
  @ApiNotFoundResponse({ description: 'No usable challenge' })
  async answerChallenge(
    @Param('id') id: string,
    @Body() resource: AnswerChallengeResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ChallengeResource> {
    const challengeId = VerificationParamsAssembler.toChallengeId(id);
    await this.commands.answerVerificationChallenge(
      new AnswerVerificationChallengeCommand(challengeId, resource.code),
    );
    const challenge = await this.requery(challengeId);
    if (challenge.standing === ChallengeStanding.EXPIRED) response.status(HttpStatus.GONE);
    else if (challenge.standing !== ChallengeStanding.CONFIRMED) response.status(HttpStatus.CONFLICT);
    return challenge;
  }

  /**
   * Answers usability and remaining attempts for the pair (UC4, no facts).
   */
  @Get('standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChallengeStandingResource })
  async getStanding(
    @Query('personId') personId: string,
    @Query('purpose') purpose: string,
  ): Promise<ChallengeStandingResource> {
    const answer = await this.queries.getChallengeStandingByPersonAndPurpose(
      new GetChallengeStandingByPersonAndPurposeQuery(
        VerificationParamsAssembler.toPersonId(personId),
        VerificationParamsAssembler.toPurpose(purpose),
      ),
    );
    return new ChallengeStandingResource(answer.usable, answer.remaining);
  }

  /**
   * Returns every persisted challenge for the pair, ordered by request time.
   */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [ChallengeResource] })
  async getHistory(
    @Query('personId') personId: string,
    @Query('purpose') purpose: string,
  ): Promise<ChallengeResource[]> {
    const challenges = await this.queries.getChallengeHistoryByPersonAndPurpose(
      new GetChallengeHistoryByPersonAndPurposeQuery(
        VerificationParamsAssembler.toPersonId(personId),
        VerificationParamsAssembler.toPurpose(purpose),
      ),
    );
    return challenges.map((challenge) => ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge));
  }

  /**
   * Re-reads the saved aggregate to rebuild the response resource.
   * @param challengeId Challenge just written.
   */
  private async requery(challengeId: ChallengeId): Promise<ChallengeResource> {
    const challenge: VerificationChallenge | null = await this.queries.getChallengeById(
      new GetChallengeByIdQuery(challengeId),
    );
    if (!challenge) throw new NotFoundException();
    return ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge);
  }
}
