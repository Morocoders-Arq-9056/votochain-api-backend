import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { NOTIFICATION_CONTEXT_FACADE, type NotificationContextFacade } from "../../../../../notifications/interfaces/acl/notification-context.facade.js";
import { ExternalIamService } from "./external-iam.service.js";

/**
 * Outbound port through which Verification instructs delivery of the plain
 * one-time code to a person's contact channel.
 *
 * Notifications is another bounded context, so no infrastructure of this
 * context implements it: the adapter is the whole ACL. Sprint-01/02 bind a
 * log-only adapter (no real email sender yet); once a sender exists, bind a
 * facade-backed adapter over `NOTIFICATION_CONTEXT_FACADE` here — one-line
 * swap, never an `if(mock)` in the command service.
 *
 * The plain code must never be written to logs or events (it is a secret):
 * the log-only adapter records only the fact that a code was issued.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const NOTIFICATION_DELIVERY_SERVICE = Symbol('NOTIFICATION_DELIVERY_SERVICE');

export interface NotificationDeliveryService {
  /**
   * Instructs delivery of the plain code for a challenge.
   * @param personId Person id (`per-` prefixed string).
   * @param plainCode Plain code; secret, never logged or persisted by the app.
   * @param purpose Proof purpose.
   * @param challengeId Challenge id for idempotent dispatch keys.
   */
  sendCode(personId: string, plainCode: string, purpose: string, challengeId?: string): Promise<void>;
}

/**
 * Log-only default adapter: records that a code was issued WITHOUT the code
 * itself. Replaced by a facade-backed adapter once an email sender exists.
 */
@Injectable()
export class LogOnlyNotificationDeliveryAdapter implements NotificationDeliveryService {
  private readonly logger = new Logger(LogOnlyNotificationDeliveryAdapter.name);

  /**
   * Logs the issuance fact only; the plain code never reaches the logger.
   * @inheritdoc
   */
  async sendCode(personId: string, _plainCode: string, purpose: string, _challengeId?: string): Promise<void> {
    this.logger.log(`code issued to ${personId} for ${purpose} (delivery not wired)`);
  }
}

/**
 * Facade-backed adapter: resolves the recorded address via the IAM ACL and
 * requests a `challenge-code` dispatch via the Notifications facade.
 * Failures are logged, never thrown — the challenge row already committed.
 */
@Injectable()
export class FacadeNotificationDeliveryAdapter implements NotificationDeliveryService {
  private readonly logger = new Logger(FacadeNotificationDeliveryAdapter.name);

  constructor(
    private readonly iam: ExternalIamService,
    @Optional() @Inject(NOTIFICATION_CONTEXT_FACADE) private readonly notifications?: NotificationContextFacade,
  ) {}

  async sendCode(personId: string, plainCode: string, purpose: string, challengeId?: string): Promise<void> {
    if (!this.notifications) {
      this.logger.log(`code issued to ${personId} for ${purpose} (delivery not wired)`);
      return;
    }
    try {
      const email = await this.iam.getEmailByPersonId(personId);
      if (!email) {
        this.logger.warn(`challenge ${challengeId ?? ''} has no recorded address for ${personId}`);
        return;
      }
      const key = `challenge:${challengeId ?? `${personId}:${purpose}:${Date.now()}`}`;
      await this.notifications.requestDelivery(key, email, 'challenge-code', { code: plainCode }, `challenge ${purpose}`);
    } catch (err) {
      this.logger.warn(`challenge-code dispatch failed for ${personId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
