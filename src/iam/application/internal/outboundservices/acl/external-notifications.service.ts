/**
 * Outbound ACL port through which IAM asks Notifications to deliver
 * person notices (welcome, security, suspension, address-change). Only
 * template + address + reason cross; business rules never do (R14).
 * Sprint-01 binds the LogOnly fake; Sprint-02 binds the real Notifications.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
export const EXTERNAL_NOTIFICATIONS_SERVICE = Symbol('EXTERNAL_NOTIFICATIONS_SERVICE');

/**
 * Minimal notice-sending contract consumed by IAM event handlers.
 */
export interface ExternalNotificationsService {
  /**
   * Sends the welcome notice for a freshly registered identity.
   * @param email Destination address.
   */
  welcome(email: string): Promise<void>;

  /**
   * Sends a security notice (secret change, suspension, restore).
   * @param email Destination address.
   * @param reason Machine-readable reason for the notice.
   */
  security(email: string, reason: string): Promise<void>;
}
