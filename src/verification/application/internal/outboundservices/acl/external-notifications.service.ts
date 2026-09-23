/**
 * Outbound ACL port through which Verification instructs Notifications to
 * deliver the plain code (delivery intent, owned by Notifications).
 * The code travels by ACL, never by domain event. Sprint-01 binds the
 * LogOnly fake; Sprint-02 binds real Notifications.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const EXTERNAL_NOTIFICATIONS_SERVICE = Symbol('EXTERNAL_NOTIFICATIONS_SERVICE');

export interface ExternalNotificationsService {
  /**
   * Instructs delivery of a one-time code to the person.
   * @param personId Person id (`per-` prefixed string).
   * @param plainCode Plain code, alive only in the caller scope.
   * @param purpose Proof purpose (`login|email-verification|password-reset`).
   */
  sendCode(personId: string, plainCode: string, purpose: string): Promise<void>;
}
