import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ApiConflictResponse, ApiGoneResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { VERIFICATION_COMMAND_SERVICE } from '../../../domain/services/verification-command.service.js';
import type { VerificationCommandService } from '../../../domain/services/verification-command.service.js';
import { VERIFICATION_QUERY_SERVICE } from '../../../domain/services/verification-query.service.js';
import type { VerificationQueryService } from '../../../domain/services/verification-query.service.js';
import { AnswerVerificationChallengeCommand } from '../../../domain/model/commands/answer-verification-challenge.command.js';
import { GetChallengeByIdQuery } from '../../../domain/model/queries/get-challenge-by-id.query.js';
import { ChallengeId } from '../../../domain/model/valueobjects/challenge-id.value-object.js';
import { ChallengeStanding } from '../../../domain/model/valueobjects/challenge-standing.value-object.js';
import { VerificationChallenge } from '../../../domain/model/aggregates/verification-challenge.aggregate.js';
import { AnswerChallengeResource } from '../resources/answer-challenge.resource.js';
import { ChallengeResource } from '../resources/challenge.resource.js';
import { VerificationParamsAssembler } from '../transform/verification-params.assembler.js';
import { ChallengeResourceFromEntityAssembler } from '../transform/challenge-resource-from-entity.assembler.js';
import { VerificationExceptionFilter } from '../filters/verification-exception.filter.js';

/**
 * Thin inbound adapter for judging presented codes against an open challenge:
 * confirms, counts, or consumes. Attempts never outlive the challenge they
 * were presented against — this controller judges facets, the challenge in
 * `ChallengesController` owns the lifecycle.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-26
 */
@ApiTags('answers')
@Controller('challenges/:id/answers')
@UseFilters(VerificationExceptionFilter)
export class AnswersController {
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
   * Judges one presented code: confirms, counts, or consumes the challenge.
   * Still OPEN after answering → 409 with remaining; consumed → 409 with
   * reason; window elapsed → 410 gone.
   */
  @Post()
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
   * Re-reads the judged aggregate to rebuild the response resource.
   * @param challengeId Challenge just answered.
   */
  private async requery(challengeId: ChallengeId): Promise<ChallengeResource> {
    const challenge: VerificationChallenge | null = await this.queries.getChallengeById(
      new GetChallengeByIdQuery(challengeId),
    );
    if (!challenge) throw new NotFoundException();
    return ChallengeResourceFromEntityAssembler.toResourceFromEntity(challenge);
  }
}
