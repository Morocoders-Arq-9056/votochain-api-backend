import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryAbandonedEvent } from "../../../domain/model/events/delivery-abandoned.event.js";
import { ExternalVotingService } from "../outboundservices/acl/external-voting.service.js";

/** In-module observer of the abandoned terminal outcome. Notifies Voting through the ACL (R5). */
@Injectable()
export class DeliveryAbandonedEventHandler {
  private readonly logger = new Logger(DeliveryAbandonedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryAbandonedEvent.eventName, { async: true })
  async handleDeliveryAbandoned(event: DeliveryAbandonedEvent): Promise<void> {
    try { await this.voting.notifyAbandoned(event.orderId.value, event.reason.value); }
    catch (e) { this.logger.error(`notifyAbandoned failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}
