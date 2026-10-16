import { Inject, Injectable } from "@nestjs/common";
import { DELIVERY_QUERY_SERVICE } from "../../domain/services/delivery-query.service.js";
import type { DeliveryQueryService } from "../../domain/services/delivery-query.service.js";
import { DeliveryOrderId } from "../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { GetDeliveryOrderStandingByIdQuery } from "../../domain/model/queries/delivery.queries.js";
import type { RelayContextFacade } from "../../interfaces/acl/relay-context.facade.js";

/**
 * Application implementation of the published `RELAY_CONTEXT_FACADE`.
 * Primitives in/out; the consumer translates to its own VOs.
 */
@Injectable()
export class RelayContextFacadeImpl implements RelayContextFacade {
  constructor(@Inject(DELIVERY_QUERY_SERVICE) private readonly queries: DeliveryQueryService) {}

  async answerStanding(orderId: string): Promise<{ standing: string; reason: string | null }> {
    const answer = await this.queries.getDeliveryOrderStandingById(
      new GetDeliveryOrderStandingByIdQuery(DeliveryOrderId.of(orderId)));
    return { standing: answer.standing, reason: answer.reason };
  }
}
