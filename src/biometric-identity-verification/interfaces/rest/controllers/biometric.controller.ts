import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CompleteLivenessCommand } from '../../../domain/model/commands/complete-liveness.command.js';
import { EnrollBiometricCommand } from '../../../domain/model/commands/enroll-biometric.command.js';
import { RecordVerdictCommand } from '../../../domain/model/commands/record-verdict.command.js';
import { RequestComparisonCommand } from '../../../domain/model/commands/request-comparison.command.js';
import { RevokeBiometricProfileCommand } from '../../../domain/model/commands/revoke-biometric-profile.command.js';
import { StartLivenessChallengeCommand } from '../../../domain/model/commands/start-liveness-challenge.command.js';
import { GetAttemptHistoryByPersonQuery } from '../../../domain/model/queries/get-attempt-history-by-person.query.js';
import { GetBiometricProfileByIdQuery } from '../../../domain/model/queries/get-biometric-profile-by-id.query.js';
import { GetReferenceStandingByPersonQuery } from '../../../domain/model/queries/get-reference-standing-by-person.query.js';
import { GetVerificationAttemptByIdQuery } from '../../../domain/model/queries/get-verification-attempt-by-id.query.js';
import { GetVerificationStandingByPersonQuery } from '../../../domain/model/queries/get-verification-standing-by-person.query.js';
import { BIOMETRIC_COMMAND_SERVICE, type BiometricCommandService } from '../../../domain/services/biometric-command.service.js';
import { BIOMETRIC_QUERY_SERVICE, type BiometricQueryService } from '../../../domain/services/biometric-query.service.js';
import { AttemptHistoryResource } from '../resources/attempt-history.resource.js';
import { AttemptResource } from '../resources/attempt.resource.js';
import { CompleteLivenessResource } from '../resources/complete-liveness.resource.js';
import { EnrollBiometricResource } from '../resources/enroll-biometric.resource.js';
import { ProfileResource } from '../resources/profile.resource.js';
import { VerifiedNowResource } from '../resources/verified-now.resource.js';
import { BiometricExceptionFilter } from '../filters/biometric-exception.filter.js';
import { BiometricParamsAssembler } from '../transform/biometric-params.assembler.js';
import { BiometricResourceFromEntityAssembler } from '../transform/biometric-resource-from-entity.assembler.js';

/**
 * Thin inbound adapter for biometric enrollment, liveness (UC2 anchor),
 * comparison, verdict and erasure, plus standing reads. No business rules.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@ApiTags('biometric')
@Controller('biometric')
@UseFilters(BiometricExceptionFilter)
export class BiometricController {
  constructor(
    @Inject(BIOMETRIC_COMMAND_SERVICE) private readonly commands: BiometricCommandService,
    @Inject(BIOMETRIC_QUERY_SERVICE) private readonly queries: BiometricQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ProfileResource })
  @ApiConflictResponse({ description: 'A live reference already exists for the person' })
  async enrollBiometric(
    @Body() resource: EnrollBiometricResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProfileResource> {
    const id = await this.commands.enrollBiometric(
      new EnrollBiometricCommand(BiometricParamsAssembler.toPersonId(resource.personId)),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/biometric/profiles/${id.value}`);
    return this.requeryProfile(id.value);
  }

  @Delete('profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({ description: 'Unknown profile' })
  async revokeBiometricProfile(@Param('id') id: string): Promise<void> {
    await this.commands.revokeBiometricProfile(
      new RevokeBiometricProfileCommand(BiometricParamsAssembler.toBiometricProfileId(id)),
    );
  }

  @Get('profiles/standing')
  @HttpCode(HttpStatus.OK)
  async getReferenceStanding(@Query('personId') personId: string): Promise<ProfileResource | VerifiedNowResource> {
    const live = await this.queries.getReferenceStandingByPerson(
      new GetReferenceStandingByPersonQuery(BiometricParamsAssembler.toPersonId(personId)),
    );
    return BiometricResourceFromEntityAssembler.toVerifiedNowResource({ verifiedNow: live.live, reason: null });
  }

  @Post('attempts')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: AttemptResource })
  @ApiNotFoundResponse({ description: 'No live reference for the person' })
  async startLivenessChallenge(
    @Body() resource: EnrollBiometricResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AttemptResource> {
    const id = await this.commands.startLivenessChallenge(
      new StartLivenessChallengeCommand(BiometricParamsAssembler.toPersonId(resource.personId)),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/biometric/attempts/${id.value}`);
    return this.requeryAttempt(id.value);
  }

  @Post('attempts/:id/liveness')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AttemptResource })
  @ApiNotFoundResponse({ description: 'Unknown attempt' })
  async completeLiveness(
    @Param('id') id: string,
    @Body() resource: CompleteLivenessResource,
  ): Promise<AttemptResource> {
    const attemptId = BiometricParamsAssembler.toVerificationAttemptId(id);
    await this.commands.completeLiveness(new CompleteLivenessCommand(attemptId, resource.present));
    return this.requeryAttempt(attemptId.value);
  }

  @Post('attempts/:id/comparison')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AttemptResource })
  async requestComparison(@Param('id') id: string): Promise<AttemptResource> {
    const attemptId = BiometricParamsAssembler.toVerificationAttemptId(id);
    await this.commands.requestComparison(new RequestComparisonCommand(attemptId));
    return this.requeryAttempt(attemptId.value);
  }

  @Post('attempts/:id/verdict')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AttemptResource })
  async recordVerdict(@Param('id') id: string): Promise<AttemptResource> {
    const attemptId = BiometricParamsAssembler.toVerificationAttemptId(id);
    await this.commands.recordVerdict(new RecordVerdictCommand(attemptId, new Date()));
    return this.requeryAttempt(attemptId.value);
  }

  @Get('attempts/standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VerifiedNowResource })
  async getVerificationStanding(@Query('personId') personId: string): Promise<VerifiedNowResource> {
    const standing = await this.queries.getVerificationStandingByPerson(
      new GetVerificationStandingByPersonQuery(BiometricParamsAssembler.toPersonId(personId), new Date()),
    );
    return BiometricResourceFromEntityAssembler.toVerifiedNowResource(standing);
  }

  @Get('attempts/history')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AttemptHistoryResource })
  async getAttemptHistory(@Query('personId') personId: string): Promise<AttemptHistoryResource> {
    const history = await this.queries.getAttemptHistoryByPerson(
      new GetAttemptHistoryByPersonQuery(BiometricParamsAssembler.toPersonId(personId)),
    );
    return BiometricResourceFromEntityAssembler.toAttemptHistoryResource(history);
  }

  private async requeryProfile(id: string): Promise<ProfileResource> {
    const found = await this.queries.getBiometricProfileById(
      new GetBiometricProfileByIdQuery(BiometricParamsAssembler.toBiometricProfileId(id)),
    );
    if (!found) throw new NotFoundException();
    return BiometricResourceFromEntityAssembler.toProfileResource(found);
  }

  private async requeryAttempt(id: string): Promise<AttemptResource> {
    const found = await this.queries.getVerificationAttemptById(
      new GetVerificationAttemptByIdQuery(BiometricParamsAssembler.toVerificationAttemptId(id)),
    );
    if (!found) throw new NotFoundException();
    return BiometricResourceFromEntityAssembler.toAttemptResource(found);
  }
}
