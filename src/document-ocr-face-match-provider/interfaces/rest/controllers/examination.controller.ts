import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExamineDocumentExaminationCommand } from '../../../domain/model/commands/examine-document-examination.command.js';
import { RequestDocumentReexaminationCommand } from '../../../domain/model/commands/request-document-reexamination.command.js';
import { GetExaminationByIdQuery } from '../../../domain/model/queries/get-examination-by-id.query.js';
import { GetExaminationHistoryByPersonAndDocumentQuery } from '../../../domain/model/queries/get-examination-history-by-person-and-document.query.js';
import { GetExaminationStandingByPersonAndDocumentQuery } from '../../../domain/model/queries/get-examination-standing-by-person-and-document.query.js';
import { EXAMINATION_COMMAND_SERVICE, type ExaminationCommandService } from '../../../domain/services/examination-command.service.js';
import { EXAMINATION_QUERY_SERVICE, type ExaminationQueryService } from '../../../domain/services/examination-query.service.js';
import { ExaminationHistoryResource } from '../resources/examination-history.resource.js';
import { ExaminationResource } from '../resources/examination.resource.js';
import { ExaminationStandingResource } from '../resources/examination-standing.resource.js';
import { RequestExaminationResource } from '../resources/request-examination.resource.js';
import { ExaminationExceptionFilter } from '../filters/examination-exception.filter.js';
import { ExaminationParamsAssembler } from '../transform/examination-params.assembler.js';
import { ExaminationResourceFromEntityAssembler } from '../transform/examination-resource-from-entity.assembler.js';
import { RequestExaminationCommandFromResourceAssembler } from '../transform/request-examination-command-from-resource.assembler.js';

/**
 * Thin inbound adapter for document examinations: request, reexamine,
 * examine (UC2 anchor), standing and history. No business rules.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@ApiTags('examinations')
@Controller('examinations')
@UseFilters(ExaminationExceptionFilter)
export class ExaminationController {
  constructor(
    @Inject(EXAMINATION_COMMAND_SERVICE) private readonly commands: ExaminationCommandService,
    @Inject(EXAMINATION_QUERY_SERVICE) private readonly queries: ExaminationQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ExaminationResource })
  @ApiConflictResponse({ description: 'An examination is already OPEN for the pair' })
  async requestExamination(
    @Body() resource: RequestExaminationResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ExaminationResource> {
    const id = await this.commands.requestDocumentExamination(
      RequestExaminationCommandFromResourceAssembler.toCommandFromResource(resource),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/examinations/${id.value}`);
    return this.requery(id.value);
  }

  @Post(':id/reexaminations')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ExaminationResource })
  @ApiConflictResponse({ description: 'Prior examination is still OPEN' })
  @ApiNotFoundResponse({ description: 'Unknown examination' })
  async requestReexamination(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ExaminationResource> {
    const newId = await this.commands.requestDocumentReexamination(
      new RequestDocumentReexaminationCommand(ExaminationParamsAssembler.toExaminationId(id)),
    );
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/examinations/${newId.value}`);
    return this.requery(newId.value);
  }

  @Post(':id/examine')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ExaminationResource })
  @ApiNotFoundResponse({ description: 'Unknown examination' })
  async examine(@Param('id') id: string): Promise<ExaminationResource> {
    const examinationId = ExaminationParamsAssembler.toExaminationId(id);
    await this.commands.examineDocumentExamination(new ExamineDocumentExaminationCommand(examinationId));
    return this.requery(examinationId.value);
  }

  @Get('standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ExaminationStandingResource })
  async getStanding(
    @Query('personId') personId: string,
    @Query('documentRef') documentRef: string,
  ): Promise<ExaminationStandingResource> {
    const answer = await this.queries.getExaminationStandingByPersonAndDocument(
      new GetExaminationStandingByPersonAndDocumentQuery(
        ExaminationParamsAssembler.toPersonId(personId),
        ExaminationParamsAssembler.toDocumentRef(documentRef),
      ),
    );
    return ExaminationResourceFromEntityAssembler.toStandingResource(answer);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ExaminationHistoryResource })
  async getHistory(
    @Query('personId') personId: string,
    @Query('documentRef') documentRef: string,
  ): Promise<ExaminationHistoryResource> {
    const history = await this.queries.getExaminationHistoryByPersonAndDocument(
      new GetExaminationHistoryByPersonAndDocumentQuery(
        ExaminationParamsAssembler.toPersonId(personId),
        ExaminationParamsAssembler.toDocumentRef(documentRef),
      ),
    );
    return ExaminationResourceFromEntityAssembler.toHistoryResource(history);
  }

  private async requery(id: string): Promise<ExaminationResource> {
    const found = await this.queries.getExaminationById(
      new GetExaminationByIdQuery(ExaminationParamsAssembler.toExaminationId(id)),
    );
    if (!found) throw new NotFoundException();
    return ExaminationResourceFromEntityAssembler.toResourceFromEntity(found);
  }
}
