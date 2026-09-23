import { Injectable, Logger } from "@nestjs/common";
import type { ExternalNotificationsService } from "../../application/internal/outboundservices/acl/external-notifications.service.js";

/**
 * Sprint-01 fake: delivery instructions are logged and resolved, never sent.
 * The plain code is logged (dev visibility); Sprint-02 binds the real
 * Notifications facade. Grep-able by design: LogOnlyNotificationsService.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class LogOnlyNotificationsService implements ExternalNotificationsService {
  private readonly logger = new Logger(LogOnlyNotificationsService.name);

  /**
   * Logs the delivery instruction instead of delivering it.
   * @param personId Person id (`per-` prefixed string).
   * @param plainCode Plain code (dev log only, never persisted).
   * @param purpose Proof purpose.
   */
  async sendCode(personId: string, plainCode: string, purpose: string): Promise<void> {
    this.logger.log(`sendCode to ${personId} for ${purpose}: ${plainCode}`);
  }
}
