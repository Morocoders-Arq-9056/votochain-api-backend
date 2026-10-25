import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DELIVERY_COMMAND_SERVICE } from '../../../domain/services/delivery-command.service.js';
import type { DeliveryCommandService } from '../../../domain/services/delivery-command.service.js';
import { DELIVERY_QUERY_SERVICE } from '../../../domain/services/delivery-query.service.js';
import type { DeliveryQueryService } from '../../../domain/services/delivery-query.service.js';
import { RelayExceptionFilter } from '../filters/relay-exception.filter.js';
import { AcceptDeliveryResource, DeliveryAttemptResource, DeliveryStandingResource } from '../resources/delivery.resource.js';
import { AcceptDeliveryCommandFromResourceAssembler, DeliveryParamsAssembler } from '../transform/delivery-command-from-resource.assembler.js';

/**
 * Thin inbound adapter: intake is 202-async (queue + ledger); clients poll
 * standing / sending-order / attempt-history.
 */
@ApiTags('deliveries')
@Controller('deliveries')
@UseFilters(RelayExceptionFilter)
export class DeliveryController {
  constructor(
    @Inject(DELIVERY_COMMAND_SERVICE) private readonly commands: DeliveryCommandService,
    @Inject(DELIVERY_QUERY_SERVICE) private readonly queries: DeliveryQueryService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async accept(
    @Body() resource: AcceptDeliveryResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ id: string }> {
    const id = await this.commands.acceptDeliveryOrder(
      AcceptDeliveryCommandFromResourceAssembler.toCommand(resource));
    response.location(`/${this.config.get<string>('app.prefix', 'api/v1')}/deliveries/${id.value}`);
    return { id: id.value };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async standing(@Param('id') id: string): Promise<DeliveryStandingResource> {
    const answer = await this.queries.getDeliveryOrderStandingById(DeliveryParamsAssembler.toStandingQuery(id));
    return { standing: answer.standing, reason: answer.reason };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async byPayer(@Query('payer') payer: string): Promise<{ id: string; standing: string }[]> {
    if (!payer?.trim()) throw new BadRequestException('payer query required');
    const orders = await this.queries.getDeliverySendingOrderByPayer(DeliveryParamsAssembler.toSendingOrderQuery(payer));
    return orders.map((o) => ({ id: o.id.value, standing: o.standing }));
  }

  @Get(':id/attempts')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [DeliveryAttemptResource] })
  async attempts(@Param('id') id: string): Promise<DeliveryAttemptResource[]> {
    const history = await this.queries.getDeliveryAttemptHistoryByOrder(DeliveryParamsAssembler.toAttemptHistoryQuery(id));
    return history.map((a) => ({ attemptNo: a.nro, outcome: a.outcome, reason: a.reason?.value ?? null }));
  }
}
