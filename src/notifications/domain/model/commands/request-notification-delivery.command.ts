import { DeliveryAddress } from "../valueobjects/delivery-address.value-object.js";
import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";

/**
 * Command requesting delivery of a notification intent (UC1 anchor).
 *
 * Carries only template + address + reason + key: no requester rule leaks in.
 * The template key is resolved against the catalog in application before the
 * unit of work; the template values travel raw and render outside.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RequestNotificationDeliveryCommand {
  constructor(
    public readonly key: IdempotencyKey,
    public readonly address: DeliveryAddress,
    public readonly templateKey: string,
    public readonly templateValues: Record<string, string>,
    public readonly reason: string,
  ) {
    if (!key) throw new Error('key required');
    if (!address) throw new Error('address required');
    if (!templateKey?.trim()) throw new Error('templateKey required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
