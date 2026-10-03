import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryRequestedEvent } from "../../../domain/model/events/delivery-requested.event.js";
import { EMAIL_SENDING_SERVICE } from "../outboundservices/email/email-sending.service.js";
import type { EmailSendingService } from "../outboundservices/email/email-sending.service.js";

/**
 * In-module handler instructing the outside executor after commit.
 * Failures never throw to the bus: they are observed back via the UC3
 * webhook (`recordNotificationDeliveryFailure`). Skill rule: `@OnEvent`
 * lives only in the emitting module.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class DeliveryRequestedEventHandler {
  private readonly logger = new Logger(DeliveryRequestedEventHandler.name);

  /**
   * Wires the handler over the executor port.
   * @param sender Executor port (LogOnly default; SES/SendGrid one-line swap).
   */
  constructor(@Inject(EMAIL_SENDING_SERVICE) private readonly sender: EmailSendingService) {}

  /**
   * Instructs the send for a requested delivery. Observed back via UC2/UC3.
   * @param event The requested delivery with address, template and reason.
   */
  @OnEvent(DeliveryRequestedEvent.eventName, { async: true })
  async handleDeliveryRequested(event: DeliveryRequestedEvent): Promise<void> {
    try {
      await this.sender.send(event.address.value, event.template.key, event.template.values);
    } catch (err) {
      this.logger.warn(`send failed for dispatch ${event.dispatchId.value}: ${(err as Error).message}`);
    }
  }
}
