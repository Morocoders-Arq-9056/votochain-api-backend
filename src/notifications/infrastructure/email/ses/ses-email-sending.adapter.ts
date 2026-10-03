import { Injectable, Logger } from "@nestjs/common";
import type { EmailSendingService } from "../../../application/internal/outboundservices/email/email-sending.service.js";

/**
 * SES executor adapter (stub). Renders `templateKey` + `values` through the
 * SES client; outcomes are observed back via the UC2/UC3 webhooks.
 * Swappable with the LogOnly adapter on one provider line; application
 * code is unchanged.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class SesEmailSendingAdapter implements EmailSendingService {
  private readonly logger = new Logger(SesEmailSendingAdapter.name);

  /**
   * Sends through SES (stub: logs until the client lands).
   * @param to Destination address.
   * @param templateKey Known template key.
   * @param values Render values for the template.
   */
  async send(to: string, templateKey: string, values: Record<string, string>): Promise<void> {
    this.logger.log(`ses send to=${to} template=${templateKey} values=${JSON.stringify(values)}`);
  }
}
