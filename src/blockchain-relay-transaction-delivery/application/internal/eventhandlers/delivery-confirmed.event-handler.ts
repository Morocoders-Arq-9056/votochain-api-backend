import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryConfirmedEvent } from "../../../domain/model/events/delivery-confirmed.event.js";
import { ExternalVotingService } from "../outboundservices/acl/external-voting.service.js";

/** In-module observer of the confirmed terminal outcome. Notifies Voting through the ACL (R5). */
@Injectable()
export class DeliveryConfirmedEventHandler {
  private readonly logger = new Logger(DeliveryConfirmedEventHandler.name);
  constructor(private readonly voting: ExternalVotingService) {}

  @OnEvent(DeliveryConfirmedEvent.eventName, { async: true })
  async handleDeliveryConfirmed(event: DeliveryConfirmedEvent): Promise<void> {
    try { await this.voting.notifyConfirmed(event.orderId.value); }
    catch (e) { this.logger.error(`notifyConfirmed failed: ${e instanceof Error ? e.message : String(e)}`); }
  }
}
