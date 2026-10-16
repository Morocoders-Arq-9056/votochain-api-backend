import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DELIVERY_QUEUE } from "../../../application/internal/outboundservices/queue/delivery-queue.service.js";
import type { DeliveryQueueService } from "../../../application/internal/outboundservices/queue/delivery-queue.service.js";

/**
 * Queue adapter for the `delivery.send` topic.
 *
 * Prod runs BullMQ + Redis (`REDIS_URL`); this adapter keeps the same port
 * contract without a hard BullMQ dependency: `enqueue()` defers `deliverOrder`
 * through the in-process bus so intake stays 202-async and transport retries
 * re-execute the domain flow (at-most-once decided by the aggregate, never
 * by the transport). Swapping to a real BullMQ worker only replaces this
 * class — no domain/application change.
 */
@Injectable()
export class BullMqDeliveryQueue implements DeliveryQueueService {
  private readonly logger = new Logger(BullMqDeliveryQueue.name);
  static readonly TOPIC = 'delivery.send';

  constructor(private readonly events: EventEmitter2) {}

  async enqueue(orderId: string): Promise<void> {
    this.logger.log(`enqueued ${orderId} on ${BullMqDeliveryQueue.TOPIC}`);
    setImmediate(() => this.events.emit(BullMqDeliveryQueue.TOPIC, { orderId }));
  }
}

export { DELIVERY_QUEUE };
