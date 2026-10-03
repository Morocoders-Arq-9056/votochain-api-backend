import { Injectable, Logger } from "@nestjs/common";
import type { EmailSendingService } from "../../../application/internal/outboundservices/email/email-sending.service.js";

/**
 * SendGrid executor adapter (stub). Renders `templateKey` + `values` through
 * the SendGrid client; outcomes are observed back via the UC2/UC3 webhooks.
 * Swappable with the LogOnly adapter on one provider line; application
 * code is unchanged.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class SendgridEmailSendingAdapter implements EmailSendingService {
  private readonly logger = new Logger(SendgridEmailSendingAdapter.name);

  /**
   * Sends through SendGrid (stub: logs until the client lands).
   * @param to Destination address.
   * @param templateKey Known template key.
   * @param values Render values for the template.
   */
  async send(to: string, templateKey: string, values: Record<string, string>): Promise<void> {
    this.logger.log(`sendgrid send to=${to} template=${templateKey} values=${JSON.stringify(values)}`);
  }
}
