import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NOTIFICATION_CONTEXT_FACADE, type NotificationContextFacade } from "../../../../../notifications/interfaces/acl/notification-context.facade.js";

/**
 * Outbound ACL toward Notifications (R11, OHS, real intent delivery).
 *
 * Every vote emits a real `dispatches` row: the vote-cast receipt notice is
 * addressed to the configured ledger audit mailbox (a vote carries a voter
 * address, never an email — the contact itself is owned by Consent,
 * Sprint-04). Only template + address + reason + idempotency key cross;
 * when/why stays here. Delivery failure never reverts the committed vote
 * (fire-and-forget with log); a repeated key is idempotent success
 * (DUPLICATE already persisted).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

  /**
   * Wires the consumer over the published Notifications facade and configuration.
   * Primitives-only at the boundary; VO translation lives inside Notifications.
   * @param notifications Published Notifications facade (R11 intents).
   * @param config Reads the ledger audit mailbox address.
   */
  constructor(
    @Inject(NOTIFICATION_CONTEXT_FACADE) private readonly notifications: NotificationContextFacade,
    private readonly config: ConfigService,
  ) {}

  /**
   * Emits the vote-cast receipt notice as a real dispatch row.
   * @param voterAddress Declared voter (`0x` + 40 hex).
   * @param voteId Vote just cast.
   */
  async voteCast(voterAddress: string, voteId: string): Promise<void> {
    const address = this.config.get<string>('NOTIFICATIONS_AUDIT_ADDRESS', 'ledger@votachain.local');
    try {
      await this.notifications.requestDelivery(
        `vote:${voteId}`,
        address,
        'vote-cast',
        { voter: voterAddress, vote: voteId },
        'vote-cast receipt',
      );
    } catch (error) {
      this.logger.warn(`voteCast notice not delivered for vote ${voteId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
