import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RelayContextFacadeImpl } from "./application/acl/relay-context-facade.impl.js";
import { DeliveryCommandServiceImpl } from "./application/internal/commandservices/delivery-command.service.impl.js";
import { DeliveryConfirmedEventHandler } from "./application/internal/eventhandlers/delivery-confirmed.event-handler.js";
import { DeliveryFailedEventHandler } from "./application/internal/eventhandlers/delivery-failed.event-handler.js";
import { DeliveryAbandonedEventHandler } from "./application/internal/eventhandlers/delivery-abandoned.event-handler.js";
import { ExternalVotingService } from "./application/internal/outboundservices/acl/external-voting.service.js";
import { DeliveryQueryServiceImpl } from "./application/internal/queryservices/delivery-query.service.impl.js";
import { DELIVERY_COMMAND_SERVICE } from "./domain/services/delivery-command.service.js";
import { DELIVERY_QUERY_SERVICE } from "./domain/services/delivery-query.service.js";
import { FEE_POLICY, RETRY_POLICY } from "./domain/services/delivery-policies.service.js";
import { DELIVERY_ORDER_REPOSITORY } from "./domain/repositories/delivery-order.repository.js";
import { LEDGER_GATEWAY } from "./application/internal/outboundservices/ledger/ledger-gateway.service.js";
import { DELIVERY_QUEUE } from "./application/internal/outboundservices/queue/delivery-queue.service.js";
import { DeliveryOrderRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/delivery-order-repository.impl.js";
import { DeliveryPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/delivery-persistence.assembler.js";
import { DeliveryOrderOrmEntity, SendingAttemptOrmEntity } from "./infrastructure/persistence/typeorm/entities/delivery.orm-entities.js";
import { PolygonAmoyGateway } from "./infrastructure/ledger/polygon-amoy/polygon-amoy-ledger.gateway.js";
import { BullMqDeliveryQueue } from "./infrastructure/queue/bullmq/bullmq-delivery-queue.js";
import { DeliveryWorker } from "./infrastructure/queue/bullmq/delivery.worker.js";
import { BoundedRetryPolicy } from "./infrastructure/retry/bounded-retry.policy.js";
import { BalanceFeePolicy } from "./infrastructure/fees/balance-fee.policy.js";
import { RELAY_CONTEXT_FACADE } from "./interfaces/acl/relay-context.facade.js";
import { DeliveryController } from "./interfaces/rest/controllers/delivery.controller.js";

/**
 * Blockchain Relay & Transaction Delivery BC (supporting: signed-only
 * delivery to the ledger, at-most-once, order-preserving per payer).
 * Publishes RELAY_CONTEXT_FACADE (`answerStanding`, primitives-only, R5 OHS).
 *
 * @author morocoders-team
 * @since 2026-10-15
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryOrderOrmEntity, SendingAttemptOrmEntity]),
    ConfigModule,
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryPersistenceAssembler,
    DeliveryCommandServiceImpl,
    DeliveryQueryServiceImpl,
    DeliveryConfirmedEventHandler,
    DeliveryFailedEventHandler,
    DeliveryAbandonedEventHandler,
    ExternalVotingService,
    PolygonAmoyGateway,
    BullMqDeliveryQueue,
    DeliveryWorker,
    BoundedRetryPolicy,
    BalanceFeePolicy,
    { provide: DELIVERY_ORDER_REPOSITORY, useClass: DeliveryOrderRepositoryImpl },
    { provide: DELIVERY_COMMAND_SERVICE, useClass: DeliveryCommandServiceImpl },
    { provide: DELIVERY_QUERY_SERVICE, useClass: DeliveryQueryServiceImpl },
    { provide: LEDGER_GATEWAY, useClass: PolygonAmoyGateway },
    { provide: DELIVERY_QUEUE, useClass: BullMqDeliveryQueue },
    { provide: RETRY_POLICY, useClass: BoundedRetryPolicy },
    { provide: FEE_POLICY, useClass: BalanceFeePolicy },
    { provide: RELAY_CONTEXT_FACADE, useClass: RelayContextFacadeImpl },
  ],
  exports: [RELAY_CONTEXT_FACADE],
})
export class BlockchainRelayTransactionDeliveryModule {}
