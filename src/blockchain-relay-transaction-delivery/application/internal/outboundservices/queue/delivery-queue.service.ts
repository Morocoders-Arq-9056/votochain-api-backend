export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');

/**
 * Sending-order port (BullMQ `delivery.send` topic in prod). Transport
 * retries re-execute `deliverOrder()`; the aggregate decides the effect
 * (at-most-once by standing + partial UNIQUE).
 */
export interface DeliveryQueueService {
  enqueue(orderId: string): Promise<void>;
}
