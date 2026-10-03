import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NOTIFICATION_CONTEXT_FACADE, type NotificationContextFacade } from "../../../../../notifications/interfaces/acl/notification-context.facade.js";

/**
 * Outbound ACL through which IAM asks Notifications to deliver person
 * notices (welcome, security, suspension, address-change). Only template +
 * address + reason cross; business rules never do (R14). Failures are
 * logged, never thrown — callers already treat notices as fire-and-forget.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

  /**
   * Wires the consumer over the published Notifications facade.
   * Primitives-only at the boundary; VO translation lives inside Notifications.
   * @param notifications Published Notifications facade (R14 intents).
   */
  constructor(
    @Inject(NOTIFICATION_CONTEXT_FACADE) private readonly notifications: NotificationContextFacade,
  ) {}

  /**
   * Requests the welcome notice for a freshly registered identity.
   * Idempotent per address: repeats are refused as DUPLICATE, never resent.
   * @param email Destination address.
   */
  async welcome(email: string): Promise<void> {
    await this.request(`iam:welcome:${email}`, email, 'welcome', {}, 'iam welcome');
  }

  /**
   * Requests a security notice (secret change, suspension, restore).
   * Each call is a distinct intent (fresh key): the reason travels in values.
   * @param email Destination address (callers pass user ids for
   * session-driven notices — those are refused as malformed and logged).
   * @param reason Machine-readable reason for the notice.
   */
  async security(email: string, reason: string): Promise<void> {
    await this.request(`iam:security:${randomUUID()}`, email, 'security', { reason }, `iam ${reason}`);
  }

  /**
   * Requests one intent; malformed addresses and delivery refusals are logged.
   */
  private async request(key: string, email: string, template: string, values: Record<string, string>, reason: string): Promise<void> {
    try {
      await this.notifications.requestDelivery(key, email, template, values, reason);
    } catch (error) {
      this.logger.warn(`notice ${key} not delivered: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
