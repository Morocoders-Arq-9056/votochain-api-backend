import type { SendingAttempt } from "../model/entities/sending-attempt.entity.js";
import type { GetDeliveryAttemptHistoryByOrderQuery, GetDeliveryOrderStandingByIdQuery, GetDeliverySendingOrderByPayerQuery } from "../model/queries/delivery.queries.js";
import type { DeliveryOrder } from "../model/aggregates/delivery-order.aggregate.js";
import type { DeliveryStanding } from "../model/valueobjects/delivery-standing.value-object.js";

export const DELIVERY_QUERY_SERVICE = Symbol('DELIVERY_QUERY_SERVICE');

export interface DeliveryQueryService {
  getDeliveryOrderStandingById(q: GetDeliveryOrderStandingByIdQuery): Promise<{ standing: DeliveryStanding; reason: string | null }>;
  getDeliverySendingOrderByPayer(q: GetDeliverySendingOrderByPayerQuery): Promise<DeliveryOrder[]>;
  getDeliveryAttemptHistoryByOrder(q: GetDeliveryAttemptHistoryByOrderQuery): Promise<SendingAttempt[]>;
}
