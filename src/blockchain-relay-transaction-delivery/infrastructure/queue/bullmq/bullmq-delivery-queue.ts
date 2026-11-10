import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DELIVERY_QUEUE } from "../../../application/internal/outboundservices/queue/delivery-queue.service.js";
import type { DeliveryQueueService } from "../../../application/internal/outboundservices/queue/delivery-queue.service.js";

@Injectable()
export class BullMqDeliveryQueue implements DeliveryQueueService {
  private readonly logger = new Logger(BullMqDeliveryQueue.name);
  static readonly TOPIC = 'delivery.send';
  private queue: import('bullmq').Queue | null = null;

  constructor(
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    const driver = this.config.get<string>('relay.queueDriver', 'in-process');
    const redisUrl = this.config.get<string>('relay.redisUrl', '');
    if (driver === 'bullmq' && redisUrl) {
      try {
        // Lazy import to keep build without redis for tests
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Queue } = require('bullmq') as typeof import('bullmq');
        this.queue = new Queue(BullMqDeliveryQueue.TOPIC, { connection: { url: redisUrl } } as never);
        this.logger.log(`BullMQ queue initialized for ${BullMqDeliveryQueue.TOPIC}`);
      } catch (e) {
        this.logger.warn(`BullMQ init failed, falling back to in-process: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  async enqueue(orderId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add('deliver', { orderId }, {
        jobId: orderId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      this.logger.log(`enqueued ${orderId} via BullMQ`);
      return;
    }
    this.logger.log(`enqueued ${orderId} on ${BullMqDeliveryQueue.TOPIC} (in-process)`);
    setImmediate(() => this.events.emit(BullMqDeliveryQueue.TOPIC, { orderId }));
  }
}

export { DELIVERY_QUEUE };
