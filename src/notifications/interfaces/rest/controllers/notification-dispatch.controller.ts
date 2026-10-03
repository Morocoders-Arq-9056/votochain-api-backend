import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Post, Res, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiAcceptedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { NOTIFICATION_DISPATCH_COMMAND_SERVICE } from '../../../domain/services/notification-dispatch-command.service.js';
import type { NotificationDispatchCommandService } from '../../../domain/services/notification-dispatch-command.service.js';
import { NOTIFICATION_DISPATCH_QUERY_SERVICE } from '../../../domain/services/notification-dispatch-query.service.js';
import type { NotificationDispatchQueryService } from '../../../domain/services/notification-dispatch-query.service.js';
import { ConfirmNotificationDeliveryCommand } from '../../../domain/model/commands/confirm-notification-delivery.command.js';
import { RecordNotificationDeliveryFailureCommand } from '../../../domain/model/commands/record-notification-delivery-failure.command.js';
import { RetryNotificationDeliveryCommand } from '../../../domain/model/commands/retry-notification-delivery.command.js';
import { GetDeliveryHistoryByDispatchQuery } from '../../../domain/model/queries/get-delivery-history-by-dispatch.query.js';
import { GetDeliveryStandingByDispatchQuery } from '../../../domain/model/queries/get-delivery-standing-by-dispatch.query.js';
import { GetDeliveryStandingByKeyQuery } from '../../../domain/model/queries/get-delivery-standing-by-key.query.js';
import { DeliveryHistoryResource } from '../resources/delivery-history.resource.js';
import { DeliveryStandingResource } from '../resources/delivery-standing.resource.js';
import { RecordFailureResource } from '../resources/record-failure.resource.js';
import { RequestDeliveryResource } from '../resources/request-delivery.resource.js';
import { DeliveryStandingResourceFromEntityAssembler } from '../transform/delivery-standing-resource-from-entity.assembler.js';
import { NotificationParamsAssembler } from '../transform/notification-params.assembler.js';
import { RequestDeliveryCommandFromResourceAssembler } from '../transform/request-delivery-command-from-resource.assembler.js';
import { NotificationExceptionFilter } from '../filters/notification-exception.filter.js';

/**
 * Thin inbound adapter for delivery intents: UC1 request, UC5 standing and
 * history reads, plus the UC2–UC4 executor webhooks (confirm/fail/retry).
 * Controllers hold no rules: they assemble commands, delegate to the ports,
 * and re-query standing for the response.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@ApiTags('notifications')
@Controller('notifications/dispatches')
@UseFilters(NotificationExceptionFilter)
export class NotificationDispatchController {
  /**
   * Wires the controller over command and query service ports.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   * @param config Reads the global API prefix for Location headers.
   */
  constructor(
    @Inject(NOTIFICATION_DISPATCH_COMMAND_SERVICE) private readonly commands: NotificationDispatchCommandService,
    @Inject(NOTIFICATION_DISPATCH_QUERY_SERVICE) private readonly queries: NotificationDispatchQueryService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Requests delivery of a notification intent (UC1 anchor).
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: DeliveryStandingResource })
  async requestDelivery(
    @Body() resource: RequestDeliveryResource,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeliveryStandingResource> {
    const dispatchId = await this.commands.requestNotificationDelivery(
      RequestDeliveryCommandFromResourceAssembler.toCommand(resource),
    );
    const prefix = this.config.get<string>('app.prefix', 'api/v1');
    response.location(`/${prefix}/notifications/dispatches/` + dispatchId.value);
    return this.standingByDispatchOrFail(dispatchId.value);
  }

  /**
   * Answers the delivery standing of one dispatch by id (UC5).
   */
  @Get(':id/standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async getStandingByDispatch(@Param('id') id: string): Promise<DeliveryStandingResource> {
    return this.standingByDispatchOrFail(id);
  }

  /**
   * Answers the delivery standing of one intent by idempotency key (UC5).
   */
  @Get('by-key/:key/standing')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async getStandingByKey(@Param('key') key: string): Promise<DeliveryStandingResource> {
    const answer = await this.queries.getDeliveryStandingByKey(
      new GetDeliveryStandingByKeyQuery(NotificationParamsAssembler.toIdempotencyKey(key)),
    );
    if (!answer) throw new NotFoundException();
    return DeliveryStandingResourceFromEntityAssembler.toResource(answer);
  }

  /**
   * Reads the full attempt history of one dispatch (scrutiny).
   */
  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryHistoryResource })
  async getHistory(@Param('id') id: string): Promise<DeliveryHistoryResource> {
    await this.standingByDispatchOrFail(id);
    const answer = await this.queries.getDeliveryHistoryByDispatch(
      new GetDeliveryHistoryByDispatchQuery(NotificationParamsAssembler.toDispatchId(id)),
    );
    return new DeliveryHistoryResource(answer.dispatchId.value, answer.attempts.map((a) => ({
      at: a.at.toISOString(),
      outcome: a.outcome,
      ...(a.detail !== undefined ? { detail: a.detail } : {}),
    })));
  }

  /**
   * Retries a FAILED dispatch, re-entering REQUESTED (UC4).
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async retry(@Param('id') id: string): Promise<DeliveryStandingResource> {
    const dispatchId = NotificationParamsAssembler.toDispatchId(id);
    await this.standingByDispatchOrFail(id);
    await this.commands.retryNotificationDelivery(new RetryNotificationDeliveryCommand(dispatchId));
    return this.standingByDispatchOrFail(id);
  }

  /**
   * Confirms a REQUESTED dispatch as delivered (UC2 executor webhook).
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async confirm(@Param('id') id: string): Promise<DeliveryStandingResource> {
    const dispatchId = NotificationParamsAssembler.toDispatchId(id);
    await this.standingByDispatchOrFail(id);
    await this.commands.confirmNotificationDelivery(new ConfirmNotificationDeliveryCommand(dispatchId));
    return this.standingByDispatchOrFail(id);
  }

  /**
   * Records an executor-observed delivery failure (UC3 webhook).
   */
  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeliveryStandingResource })
  async recordFailure(
    @Param('id') id: string,
    @Body() resource: RecordFailureResource,
  ): Promise<DeliveryStandingResource> {
    const dispatchId = NotificationParamsAssembler.toDispatchId(id);
    await this.standingByDispatchOrFail(id);
    await this.commands.recordNotificationDeliveryFailure(
      new RecordNotificationDeliveryFailureCommand(dispatchId, NotificationParamsAssembler.toFailureReason(resource.reason)),
    );
    return this.standingByDispatchOrFail(id);
  }

  /**
   * Re-reads the standing answer or raises not-found for unknown ids.
   * @param id Raw dispatch id string.
   */
  private async standingByDispatchOrFail(id: string): Promise<DeliveryStandingResource> {
    const answer = await this.queries.getDeliveryStandingByDispatch(
      new GetDeliveryStandingByDispatchQuery(NotificationParamsAssembler.toDispatchId(id)),
    );
    if (!answer) throw new NotFoundException();
    return DeliveryStandingResourceFromEntityAssembler.toResource(answer);
  }
}
