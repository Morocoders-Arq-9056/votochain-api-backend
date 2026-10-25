import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryFailedEvent } from "../../../domain/model/events/delivery-failed.event.js";
import { ExternalVotingService } from "../outboundservices/acl/external-voting.service.js";

/** In-module observer of the failed outcome. Notifies Voting through the ACL (R5). */
@Injectable()
export class DeliveryFailedEventHandler {
  private readonly logger = new Logger(DeliveryFailedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryFailedEvent.eventName, { async: true })
  async handleDeliveryFailed(event: DeliveryFailedEvent): Promise<void> {
    try { await this.voting.notifyFailed(event.orderId.value, event.reason.value); }
    catch (e) { this.logger.error(`notifyFailed failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}
