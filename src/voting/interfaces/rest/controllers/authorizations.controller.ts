import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Post, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AUTHORIZATION_COMMAND_SERVICE, type VoteAuthorizationCommandService } from '../../../domain/services/authorization-command.service.js';
import { AUTHORIZATION_QUERY_SERVICE, type VoteAuthorizationQueryService } from '../../../domain/services/authorization-query.service.js';
import { GetAuthorizationByIdQuery } from '../../../domain/model/queries/get-authorization-by-id.query.js';
import { AuthorizationResource } from '../resources/authorization.resource.js';
import { RequestAuthorizationResource } from '../resources/request-authorization.resource.js';
import { VotingExceptionFilter } from '../filters/voting-exception.filter.js';
import { RequestAuthorizationCommandFromResourceAssembler } from '../transform/request-authorization-command-from-resource.assembler.js';
import { VotingResourceFromEntityAssembler } from '../transform/voting-resource-from-entity.assembler.js';

/**
 * Thin inbound adapter for vote authorizations: UC3 request (inline
 * eligibility + liveness → grant/deny).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@ApiTags('authorizations')
@Controller('authorizations')
@UseFilters(VotingExceptionFilter)
export class AuthorizationsController {
  constructor(
    @Inject(AUTHORIZATION_COMMAND_SERVICE) private readonly commands: VoteAuthorizationCommandService,
    @Inject(AUTHORIZATION_QUERY_SERVICE) private readonly queries: VoteAuthorizationQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: AuthorizationResource })
  async requestAuthorization(@Body() resource: RequestAuthorizationResource, @Res({ passthrough: true }) response: Response): Promise<AuthorizationResource> {
    const id = await this.commands.requestVoteAuthorization(
      RequestAuthorizationCommandFromResourceAssembler.toCommandFromResource(resource));
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/authorizations/${id.value}`);
    const auth = await this.queries.getAuthorizationById(new GetAuthorizationByIdQuery(id));
    if (!auth) throw new NotFoundException();
    return VotingResourceFromEntityAssembler.toAuthorizationResource(auth);
  }
}
