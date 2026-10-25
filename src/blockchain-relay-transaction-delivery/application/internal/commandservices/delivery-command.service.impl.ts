import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { DeliveryOrder } from "../../../domain/model/aggregates/delivery-order.aggregate.js";
import { AcceptDeliveryOrderCommand } from "../../../domain/model/commands/accept-delivery-order.command.js";
import { DeliverOrderCommand } from "../../../domain/model/commands/deliver-order.command.js";
import { RecordDeliveryOrderLedgerOutcomeCommand } from "../../../domain/model/commands/record-delivery-order-ledger-outcome.command.js";
import { DeliveryOrderId } from "../../../domain/model/valueobjects/delivery-order-id.value-object.js";
import { FailureReason } from "../../../domain/model/valueobjects/failure-reason.value-object.js";
import { OrderNotFoundError } from "../../../domain/exceptions/order-not-found.error.js";
import { DELIVERY_ORDER_REPOSITORY } from "../../../domain/repositories/delivery-order.repository.js";
import type { DeliveryOrderRepository } from "../../../domain/repositories/delivery-order.repository.js";
import { DeliveryCommandService } from "../../../domain/services/delivery-command.service.js";
import { FEE_POLICY, RETRY_POLICY } from "../../../domain/services/delivery-policies.service.js";
import type { FeePolicy, RetryPolicy } from "../../../domain/services/delivery-policies.service.js";
import { DELIVERY_QUEUE } from "../outboundservices/queue/delivery-queue.service.js";
import type { DeliveryQueueService } from "../outboundservices/queue/delivery-queue.service.js";
import { LEDGER_GATEWAY } from "../outboundservices/ledger/ledger-gateway.service.js";
import type { LedgerGatewayService } from "../outboundservices/ledger/ledger-gateway.service.js";

/**
 * Anchor UC2 DeliverOrder: `[uow orderâ†’publish] â†’ [uow recordSendingâ†’publish]
 * â†’ ledger.submit() outside tx â†’ recordDeliveryOrderLedgerOutcome
 * [uow observeOutcomeâ†’saveâ†’publish]`.
 */
@Injectable()
export class DeliveryCommandServiceImpl implements DeliveryCommandService {
  private readonly logger = new Logger(DeliveryCommandServiceImpl.name);
  constructor(
    @Inject(DELIVERY_ORDER_REPOSITORY) private readonly orders: DeliveryOrderRepository,
    @Inject(LEDGER_GATEWAY) private readonly ledger: LedgerGatewayService,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueueService,
    @Inject(RETRY_POLICY) private readonly retries: RetryPolicy,
    @Inject(FEE_POLICY) private readonly fees: FeePolicy,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async acceptDeliveryOrder(cmd: AcceptDeliveryOrderCommand): Promise<DeliveryOrderId> {
    const order = await this.uow.run(async () => {
      const open = await this.orders.findOpenByContent(cmd.contentRef);
      if (open) return open;
      const pos = await this.orders.nextPositionForPayer(cmd.payerRef);
      const o = DeliveryOrder.accept(DeliveryOrderId.generate(), cmd.contentRef, cmd.payerRef, pos, cmd.signedProof);
      await this.orders.save(o);
      return o;
    });
    this.publish(order);
    await this.queue.enqueue(order.id.value);
    return order.id;
  }

  async deliverOrder(cmd: DeliverOrderCommand): Promise<void> {
    const orderId = cmd.orderId;
    const ordered = await this.uow.run(async () => {
      const o = (await this.orders.findById(orderId)) ?? (() => { throw new OrderNotFoundError(); })();
      try { o.order(); } catch { return o; }
      await this.orders.save(o);
      return o;
    });
    this.publish(ordered);
    let sent = ordered;
    try {
      sent = await this.uow.run(async () => {
        const o = (await this.orders.findById(orderId))!;
        try { o.recordSending(); } catch { return o; }
        await this.orders.save(o);
        return o;
      });
      this.publish(sent);
    } catch (e) {
      this.logger.error(`recordSending failed for order ${orderId.value}: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    if (sent.standing !== 'SENT') return;
    let outcome;
    try {
      outcome = await this.ledger.submit(sent.id.value);
    } catch {
      outcome = { confirmed: false, reason: 'LEDGER_REJECTED', retryable: true };
    }
    await this.recordDeliveryOrderLedgerOutcome(new RecordDeliveryOrderLedgerOutcomeCommand(
      orderId, outcome.confirmed, outcome.reason ?? null, outcome.retryable));
  }

  async recordDeliveryOrderLedgerOutcome(cmd: RecordDeliveryOrderLedgerOutcomeCommand): Promise<void> {
    let closed: DeliveryOrder | null = null;
    try {
      closed = await this.uow.run(async () => {
        const o = (await this.orders.findById(cmd.orderId))!;
        o.observeOutcome(cmd.confirmed, cmd.reason ? FailureReason.of(cmd.reason) : null, cmd.retryable, this.retries, this.fees);
        await this.orders.save(o);
        return o;
      });
    } catch (e) {
      this.logger.error(`observeOutcome failed for order ${cmd.orderId.value}: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    if (closed) this.publish(closed);
  }

  private publish(o: DeliveryOrder): void {
    for (const e of o.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
