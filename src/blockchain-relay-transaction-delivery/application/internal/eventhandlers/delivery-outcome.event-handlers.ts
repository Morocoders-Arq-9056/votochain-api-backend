import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryAbandonedEvent, DeliveryConfirmedEvent, DeliveryFailedEvent } from "../../../domain/model/events/delivery.events.js";
import { ExternalVotingService } from "../outboundservices/acl/external-voting.service.js";

/**
 * In-module observers of terminal delivery outcomes. They notify Voting
 * through the ACL (R5); a failed notice never rolls back the committed
 * order — it only logs.
 */
@Injectable()
export class DeliveryConfirmedEventHandler {
  private readonly logger = new Logger(DeliveryConfirmedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryConfirmedEvent.eventName, { async: true })
  async handle(event: DeliveryConfirmedEvent): Promise<void> {
    try { await this.voting.notifyConfirmed(event.orderId.value); }
    catch (e) { this.logger.error(`notifyConfirmed failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}

@Injectable()
export class DeliveryFailedEventHandler {
  private readonly logger = new Logger(DeliveryFailedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryFailedEvent.eventName, { async: true })
  async handle(event: DeliveryFailedEvent): Promise<void> {
    try { await this.voting.notifyFailed(event.orderId.value, event.reason.value); }
    catch (e) { this.logger.error(`notifyFailed failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}

@Injectable()
export class DeliveryAbandonedEventHandler {
  private readonly logger = new Logger(DeliveryAbandonedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryAbandonedEvent.eventName, { async: true })
  async handle(event: DeliveryAbandonedEvent): Promise<void> {
    try { await this.voting.notifyAbandoned(event.orderId.value, event.reason.value); }
    catch (e) { this.logger.error(`notifyAbandoned failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}
