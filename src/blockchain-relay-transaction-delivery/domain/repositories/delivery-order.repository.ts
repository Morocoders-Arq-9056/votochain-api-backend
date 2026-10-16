import type { SignedContentRef } from "../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import type { DeliveryOrder } from "../model/aggregates/delivery-order.aggregate.js";
import type { DeliveryOrderId } from "../model/valueobjects/delivery-order-id.value-object.js";
import type { PayerRef } from "../model/valueobjects/payer-ref.value-object.js";
import type { SendingOrderPosition } from "../model/valueobjects/sending-order-position.value-object.js";

export const DELIVERY_ORDER_REPOSITORY = Symbol('DELIVERY_ORDER_REPOSITORY');

export interface DeliveryOrderRepository {
  findById(id: DeliveryOrderId): Promise<DeliveryOrder | null>;
  findOpenByContent(content: SignedContentRef): Promise<DeliveryOrder | null>;
  findByPayer(payer: PayerRef): Promise<DeliveryOrder[]>;
  nextPositionForPayer(payer: PayerRef): Promise<SendingOrderPosition>;
  save(order: DeliveryOrder): Promise<void>;
}
