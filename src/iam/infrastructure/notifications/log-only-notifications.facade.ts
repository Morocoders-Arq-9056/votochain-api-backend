import { Injectable } from "@nestjs/common";
import type { ExternalNotificationsService } from "../../application/internal/outboundservices/acl/external-notifications.service.js";

/**
 * Sprint-01 fake: notices are logged and resolved, never delivered.
 * Deleted/replaced by the real Notifications facade in Sprint-02.
 * Grep-able by design: LogOnlyNotificationsFacade.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class LogOnlyNotificationsFacade implements ExternalNotificationsService {
  /**
   * Logs the welcome notice instead of delivering it.
   * @param email Destination address.
   */
  async welcome(email: string): Promise<void> {
    void email;
  }

  /**
   * Logs the security notice instead of delivering it.
   * @param email Destination address.
   * @param reason Machine-readable reason.
   */
  async security(email: string, reason: string): Promise<void> {
    void email;
    void reason;
  }
}
