import { IdempotencyKey } from "../valueobjects/idempotency-key.value-object.js";

/**
 * Query answering the delivery standing of one intent by idempotency key (UC5).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class GetDeliveryStandingByKeyQuery {
  constructor(public readonly key: IdempotencyKey) {
    if (!key) throw new Error('key required');
  }
}
