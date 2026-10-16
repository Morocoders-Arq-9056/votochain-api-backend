import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ERASURE_QUERY_SERVICE, RETENTION_COMMAND_SERVICE } from '../../../domain/services/consent.services.js';
import type { ErasureQueryService, RetentionCommandService } from '../../../domain/services/consent.services.js';
import { ConsentExceptionFilter } from '../../filters/consent-exception.filter.js';
import { DefineRetentionPolicyResource } from '../resources/consent.resource.js';
import { ConsentCommandFromResourceAssembler, ConsentParamsAssembler } from '../transform/consent-command-from-resource.assembler.js';

/**
 * Thin inbound adapter for retention policies (define + read terms).
 */
@ApiTags('retention-policies')
@Controller('retention-policies')
@UseFilters(ConsentExceptionFilter)
export class RetentionPolicyController {
  constructor(
    @Inject(RETENTION_COMMAND_SERVICE) private readonly commands: RetentionCommandService,
    @Inject(ERASURE_QUERY_SERVICE) private readonly queries: ErasureQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async define(@Body() resource: DefineRetentionPolicyResource): Promise<{ id: string }> {
    const id = await this.commands.defineRetentionPolicy(
      ConsentCommandFromResourceAssembler.toDefinePolicyCommand(resource));
    return { id: id.value };
  }

  @Get(':category')
  @HttpCode(HttpStatus.OK)
  async terms(@Param('category') category: string): Promise<{ category: string; terms: Record<string, unknown> }> {
    const answer = await this.queries.getRetentionTermsByCategory(
      ConsentParamsAssembler.toRetentionTermsQuery(category));
    if (!answer) return { category, terms: {} };
    return { category: answer.category, terms: answer.terms };
  }
}
