import { Injectable, Logger } from "@nestjs/common";
import type { EmailSendingService } from "../../../application/internal/outboundservices/email/email-sending.service.js";

/**
 * Log-only executor adapter: records the instructed send, delivers nothing.
 * Default binding for tests and local runs; outcomes are simulated back
 * through the UC2/UC3 webhooks. Swap to SES/SendGrid with one provider line.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class LogOnlyEmailSendingAdapter implements EmailSendingService {
  private readonly logger = new Logger(LogOnlyEmailSendingAdapter.name);

  /**
   * Logs the instructed send without delivering.
   * @param to Destination address.
   * @param templateKey Known template key.
   * @param values Render values for the template.
   */
  async send(to: string, templateKey: string, values: Record<string, string>): Promise<void> {
    this.logger.log(`send to=${to} template=${templateKey} values=${JSON.stringify(values)}`);
  }
}
