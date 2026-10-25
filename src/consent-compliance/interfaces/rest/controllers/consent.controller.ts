import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CONSENT_COMMAND_SERVICE, CONSENT_QUERY_SERVICE } from '../../../domain/services/consent.services.js';
import type { ConsentCommandService, ConsentQueryService } from '../../../domain/services/consent.services.js';
import { ConsentExceptionFilter } from '../filters/consent-exception.filter.js';
import { ConsentStateResource, GrantConsentResource, RevokeConsentResource } from '../resources/consent.resource.js';
import { ConsentCommandFromResourceAssembler, ConsentParamsAssembler } from '../transform/consent-command-from-resource.assembler.js';

/**
 * Thin inbound adapter for consent grants/revokes + state reads.
 */
@ApiTags('consents')
@Controller('consents')
@UseFilters(ConsentExceptionFilter)
export class ConsentController {
  constructor(
    @Inject(CONSENT_COMMAND_SERVICE) private readonly commands: ConsentCommandService,
    @Inject(CONSENT_QUERY_SERVICE) private readonly queries: ConsentQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async grant(@Body() resource: GrantConsentResource): Promise<ConsentStateResource> {
    const cmd = ConsentCommandFromResourceAssembler.toGrantCommand(resource);
    await this.commands.grantConsent(cmd);
    return this.state(resource.personId, resource.scope);
  }

  @Post(':scope/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('scope') scope: string, @Body() resource: RevokeConsentResource): Promise<void> {
    await this.commands.revokeConsent(ConsentCommandFromResourceAssembler.toRevokeCommand(scope, resource));
  }

  @Get('state')
  @HttpCode(HttpStatus.OK)
  async state(@Query('personId') personId: string, @Query('scope') scope: string): Promise<ConsentStateResource> {
    const answer = await this.queries.getConsentStateByPersonAndScope(
      ConsentParamsAssembler.toStateQuery(personId, scope));
    return {
      granted: answer.granted,
      policyVersion: answer.policyVersion,
      since: answer.since ? answer.since.toISOString() : null,
      standing: answer.granted ? 'GRANTED' : 'REVOKED',
    };
  }
}
