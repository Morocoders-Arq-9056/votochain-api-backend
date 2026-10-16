import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DeliveryRetriedEvent } from "../../../domain/model/events/delivery-retried.event.js";
import { NOTIFICATION_DISPATCH_REPOSITORY } from "../../../domain/repositories/notification-dispatch.repository.js";
import type { NotificationDispatchRepository } from "../../../domain/repositories/notification-dispatch.repository.js";
import { EMAIL_SENDING_SERVICE } from "../outboundservices/email/email-sending.service.js";
import type { EmailSendingService } from "../outboundservices/email/email-sending.service.js";

/**
 * In-module handler re-instructing the send for a retried dispatch.
 *
 * `DeliveryRetriedEvent` carries only identity, so the handler re-reads the
 * dispatch to recover the address and resolved template, then calls the same
 * executor port as `DeliveryRequestedEventHandler`. Outcomes are observed
 * back via the UC2/UC3 webhooks; failures never throw to the bus.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-03
 */
@Injectable()
export class DeliveryRetriedEventHandler {
  private readonly logger = new Logger(DeliveryRetriedEventHandler.name);

  /**
   * Wires the handler over the repository and executor ports.
   * @param dispatches Repository port to recover address and template.
   * @param sender Executor port (LogOnly default; SES/SendGrid one-line swap).
   */
  constructor(
    @Inject(NOTIFICATION_DISPATCH_REPOSITORY) private readonly dispatches: NotificationDispatchRepository,
    @Inject(EMAIL_SENDING_SERVICE) private readonly sender: EmailSendingService,
  ) {}

  /**
   * Re-instructs the send for a retried delivery. Observed back via UC2/UC3.
   * @param event The retried delivery identity.
   */
  @OnEvent(DeliveryRetriedEvent.eventName, { async: true })
  async handleDeliveryRetried(event: DeliveryRetriedEvent): Promise<void> {
    try {
      const dispatch = await this.dispatches.findById(event.dispatchId);
      if (!dispatch) throw new Error(`dispatch not found: ${event.dispatchId.value}`);
      await this.sender.send(dispatch.address.value, dispatch.template.key, dispatch.template.values);
    } catch (err) {
      this.logger.warn(`retry send failed for dispatch ${event.dispatchId.value}: ${(err as Error).message}`);
    }
  }
}
