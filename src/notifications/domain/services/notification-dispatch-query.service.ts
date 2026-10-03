import { GetDeliveryHistoryByDispatchQuery } from "../model/queries/get-delivery-history-by-dispatch.query.js";
import { GetDeliveryStandingByDispatchQuery } from "../model/queries/get-delivery-standing-by-dispatch.query.js";
import { GetDeliveryStandingByKeyQuery } from "../model/queries/get-delivery-standing-by-key.query.js";
import { DeliveryHistoryAnswer } from "../model/valueobjects/delivery-history-answer.value-object.js";
import { DeliveryStandingAnswer } from "../model/valueobjects/delivery-standing-answer.value-object.js";

/**
 * Domain port for NotificationDispatch read use cases (CQRS query side).
 *
 * Naming follows skill ddd-guideliness v1.0.11: one method per query,
 * `methodName = lowerCamel(ClassName without Query suffix)`, receiving
 * the query object. Read-only: no unit of work, no mutations, no events.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface NotificationDispatchQueryService {
  /**
   * Answers the delivery standing of one dispatch by id, or null when unknown.
   * @param query Carries the dispatch id.
   */
  getDeliveryStandingByDispatch(query: GetDeliveryStandingByDispatchQuery): Promise<DeliveryStandingAnswer | null>;

  /**
   * Answers the delivery standing of one intent by idempotency key, or null when unknown.
   * @param query Carries the idempotency key.
   */
  getDeliveryStandingByKey(query: GetDeliveryStandingByKeyQuery): Promise<DeliveryStandingAnswer | null>;

  /**
   * Reads the full attempt history of one dispatch. Unknown dispatches
   * answer an empty history.
   * @param query Carries the dispatch id.
   */
  getDeliveryHistoryByDispatch(query: GetDeliveryHistoryByDispatchQuery): Promise<DeliveryHistoryAnswer>;
}
/**
 * Injection token for the {@link NotificationDispatchQueryService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const NOTIFICATION_DISPATCH_QUERY_SERVICE = Symbol('NOTIFICATION_DISPATCH_QUERY_SERVICE');
