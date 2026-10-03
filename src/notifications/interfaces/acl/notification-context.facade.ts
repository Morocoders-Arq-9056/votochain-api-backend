/**
 * Published ACL this bounded context exposes to other contexts.
 * Primitives-only at the boundary: consumers translate strings into their
 * own value objects. Exported from NotificationsModule via
 * NOTIFICATION_CONTEXT_FACADE.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const NOTIFICATION_CONTEXT_FACADE = Symbol('NOTIFICATION_CONTEXT_FACADE');

/**
 * Facade published by Notifications for intent requesters (R11, OHS) and
 * standing/history consumers (Voting per vote-cast notice, IAM per person
 * notices, scrutiny/erasure readers). Primitives-only: the only seam other
 * contexts program against — never the command port or domain VOs.
 */
export interface NotificationContextFacade {
  /**
   * Requests delivery of a notification intent (UC1 anchor).
   * Only template + address + reason + key cross; when/why stays with the
   * requester. Repeats of a seen key are refused as DUPLICATE, never resent.
   * @param key Requester-supplied idempotency key string.
   * @param address Destination address (email shape).
   * @param templateKey Known catalog key (`vote-cast|welcome|security|challenge-code`).
   * @param templateValues Raw render values for the template.
   * @param reason Machine-readable reason for the notice.
   * @returns The new dispatch id (`dsp-` prefixed string).
   */
  requestDelivery(key: string, address: string, templateKey: string, templateValues: Record<string, string>, reason: string): Promise<string>;

  /**
   * Answers the standing of one intent by idempotency key.
   * @param key Requester-supplied idempotency key string.
   */
  getStandingByKey(key: string): Promise<{ standing: string; attempts: number }>;

  /**
   * Reads the attempt history of one dispatch. Unknown dispatches answer
   * an empty attempt list.
   * @param dispatchId Dispatch id (`dsp-` prefixed string).
   */
  getHistory(dispatchId: string): Promise<{ attempts: { at: string; outcome: string }[] }>;
}
