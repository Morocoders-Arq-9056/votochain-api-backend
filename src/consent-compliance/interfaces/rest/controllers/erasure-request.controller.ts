import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ERASURE_COMMAND_SERVICE, ERASURE_QUERY_SERVICE } from '../../../domain/services/consent.services.js';
import type { ErasureCommandService, ErasureQueryService } from '../../../domain/services/consent.services.js';
import { ConsentExceptionFilter } from '../filters/consent-exception.filter.js';
import { RecordRevocationConfirmationResource, SubmitErasureRequestResource } from '../resources/consent.resource.js';
import { ConsentCommandFromResourceAssembler, ConsentParamsAssembler } from '../transform/consent-command-from-resource.assembler.js';

/**
 * Thin inbound adapter for the erasure anchor flow (UC4–UC6):
 * submit → confirm (coordinates 4 owners) → per-owner confirmations →
 * auto-complete when every owner confirmed.
 */
@ApiTags('erasure-requests')
@Controller('erasure-requests')
@UseFilters(ConsentExceptionFilter)
export class ErasureRequestController {
  constructor(
    @Inject(ERASURE_COMMAND_SERVICE) private readonly commands: ErasureCommandService,
    @Inject(ERASURE_QUERY_SERVICE) private readonly queries: ErasureQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(@Body() resource: SubmitErasureRequestResource): Promise<{ id: string }> {
    const id = await this.commands.submitErasureRequest(
      ConsentCommandFromResourceAssembler.toSubmitCommand(resource));
    return { id: id.value };
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Param('id') id: string): Promise<void> {
    await this.commands.confirmErasureRequest(ConsentCommandFromResourceAssembler.toConfirmCommand(id));
  }

  @Post(':id/confirmations')
  @HttpCode(HttpStatus.OK)
  async recordConfirmation(
    @Param('id') id: string,
    @Body() resource: RecordRevocationConfirmationResource,
  ): Promise<void> {
    await this.commands.recordRevocationConfirmation(
      ConsentCommandFromResourceAssembler.toRecordConfirmationCommand(id, resource));
  }

  @Get('standing')
  @HttpCode(HttpStatus.OK)
  async standing(@Query('personId') personId: string): Promise<{ standing: string; pending: string[]; confirmed: string[] }> {
    const answer = await this.queries.getErasureStandingByPerson(
      ConsentParamsAssembler.toErasureStandingQuery(personId));
    if (!answer) return { standing: 'NONE', pending: [], confirmed: [] };
    return { standing: answer.standing, pending: answer.pending, confirmed: answer.confirmed };
  }
}
