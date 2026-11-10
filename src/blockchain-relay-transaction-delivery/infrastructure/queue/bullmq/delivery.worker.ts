import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { DeliverOrderCommand } from "../../../domain/model/commands/deliver-order.command.js";
import { DeliveryOrderId } from "../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { DELIVERY_COMMAND_SERVICE } from "../../../domain/services/delivery-command.service.js";
import type { DeliveryCommandService } from "../../../domain/services/delivery-command.service.js";
import { BullMqDeliveryQueue } from "../bullmq/bullmq-delivery-queue.js";

@Injectable()
export class DeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryWorker.name);
  private bullWorker: import('bullmq').Worker | null = null;

  constructor(
    @Inject(DELIVERY_COMMAND_SERVICE) private readonly commands: DeliveryCommandService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`worker subscribed to transport topic ${BullMqDeliveryQueue.TOPIC} (in-process)`);
    const driver = this.config.get<string>('relay.queueDriver', 'in-process');
    const redisUrl = this.config.get<string>('relay.redisUrl', '');
    if (driver === 'bullmq' && redisUrl) {
      try {
        const { Worker } = require('bullmq') as typeof import('bullmq');
        this.bullWorker = new Worker(
          BullMqDeliveryQueue.TOPIC,
          async (job: import('bullmq').Job<{ orderId: string }>) => {
            await this.commands.deliverOrder(new DeliverOrderCommand(DeliveryOrderId.of(job.data.orderId)));
          },
          { connection: { url: redisUrl } as never, concurrency: 1 },
        );
        this.logger.log(`BullMQ worker started for ${BullMqDeliveryQueue.TOPIC} (concurrency:1)`);
      } catch (e) {
        this.logger.warn(`BullMQ worker failed to start: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bullWorker) await this.bullWorker.close();
  }

  @OnEvent(BullMqDeliveryQueue.TOPIC, { async: true })
  async onTransportSend(payload: { orderId: string }): Promise<void> {
    try {
      await this.commands.deliverOrder(new DeliverOrderCommand(DeliveryOrderId.of(payload.orderId)));
    } catch (e) {
      this.logger.error(`deliver failed for ${payload.orderId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
