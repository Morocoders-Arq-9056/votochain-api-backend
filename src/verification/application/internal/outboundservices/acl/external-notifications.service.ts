import { Injectable, Logger } from "@nestjs/common";

/**
 * Outbound ACL through which Verification instructs delivery of the plain
 * code. Notifications is another bounded context, so no infrastructure of
 * this context may implement it: this consumer is the whole ACL until
 * contact resolution (personId → email) exists. Logs and resolves, never
 * sends; the plain code is logged for dev visibility only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

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
