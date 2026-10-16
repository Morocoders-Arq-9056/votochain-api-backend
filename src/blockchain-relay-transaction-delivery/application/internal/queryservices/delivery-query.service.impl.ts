import { Inject, Injectable } from "@nestjs/common";
import { GetDeliveryAttemptHistoryByOrderQuery, GetDeliveryOrderStandingByIdQuery, GetDeliverySendingOrderByPayerQuery } from "../../../domain/model/queries/delivery.queries.js";
import type { SendingAttempt } from "../../../domain/model/entities/sending-attempt.entity.js";
import type { DeliveryOrder } from "../../../domain/model/aggregates/delivery-order.aggregate.js";
import type { DeliveryStanding } from "../../../domain/model/valueobjects/delivery-standing.value-object.js";
import { OrderNotFoundError } from "../../../domain/exceptions/order-not-found.error.js";
import { DELIVERY_ORDER_REPOSITORY } from "../../../domain/repositories/delivery-order.repository.js";
import type { DeliveryOrderRepository } from "../../../domain/repositories/delivery-order.repository.js";
import { DeliveryQueryService } from "../../../domain/services/delivery-query.service.js";

@Injectable()
export class DeliveryQueryServiceImpl implements DeliveryQueryService {
  constructor(@Inject(DELIVERY_ORDER_REPOSITORY) private readonly orders: DeliveryOrderRepository) {}

  async getDeliveryOrderStandingById(q: GetDeliveryOrderStandingByIdQuery): Promise<{ standing: DeliveryStanding; reason: string | null }> {
    const o = await this.orders.findById(q.orderId);
    if (!o) throw new OrderNotFoundError();
    return o.answerDeliveryStanding();
  }

  async getDeliverySendingOrderByPayer(q: GetDeliverySendingOrderByPayerQuery): Promise<DeliveryOrder[]> {
    return this.orders.findByPayer(q.payerRef);
  }

  async getDeliveryAttemptHistoryByOrder(q: GetDeliveryAttemptHistoryByOrderQuery): Promise<SendingAttempt[]> {
    const o = await this.orders.findById(q.orderId);
    if (!o) throw new OrderNotFoundError();
    return o.attempts;
  }
}
