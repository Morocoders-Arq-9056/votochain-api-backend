import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { DeliverOrderCommand } from "../../../domain/model/commands/deliver-order.command.js";
import { DeliveryOrderId } from "../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { DELIVERY_COMMAND_SERVICE } from "../../../domain/services/delivery-command.service.js";
import type { DeliveryCommandService } from "../../../domain/services/delivery-command.service.js";
import { BullMqDeliveryQueue } from "../bullmq/bullmq-delivery-queue.js";

/**
 * Transport worker consuming the `delivery.send` topic.
 *
 * NOTE (transport, not domain): this subscribes to the queue adapter's
 * in-process topic via the event bus only because `BullMqDeliveryQueue`
 * defers through `EventEmitter2` until Redis/BullMQ lands. It never
 * subscribes to a domain `*.eventName`. Transport re-execution is NOT
 * domain retry — the aggregate decides the effect (idempotent by standing).
 */
@Injectable()
export class DeliveryWorker implements OnModuleInit {
  private readonly logger = new Logger(DeliveryWorker.name);

  constructor(
    @Inject(DELIVERY_COMMAND_SERVICE) private readonly commands: DeliveryCommandService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.logger.log(`worker subscribed to transport topic ${BullMqDeliveryQueue.TOPIC}`);
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
