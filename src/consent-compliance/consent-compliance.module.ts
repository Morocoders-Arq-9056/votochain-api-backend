import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConsentContextFacadeImpl } from "./application/acl/consent-context-facade.impl.js";
import { ConsentCommandServiceImpl } from "./application/internal/commandservices/consent-command.service.impl.js";
import { ErasureCommandServiceImpl } from "./application/internal/commandservices/erasure-command.service.impl.js";
import { RetentionCommandServiceImpl } from "./application/internal/commandservices/retention-command.service.impl.js";
import { ErasureConfirmedEventHandler } from "./application/internal/eventhandlers/erasure-confirmed.event-handler.js";
import { RevocationConfirmedEventHandler } from "./application/internal/eventhandlers/revocation-confirmed.event-handler.js";
import { ExternalBiometricService } from "./application/internal/outboundservices/acl/external-biometric.service.js";
import { ExternalIamService } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { ExternalMembershipService } from "./application/internal/outboundservices/acl/external-membership.service.js";
import { ExternalNotificationsService } from "./application/internal/outboundservices/acl/external-notifications.service.js";
import { ExternalWalletService } from "./application/internal/outboundservices/acl/external-wallet.service.js";
import { ConsentQueryServiceImpl, ErasureQueryServiceImpl } from "./application/internal/queryservices/consent-query.service.impl.js";
import { CONSENT_COMMAND_SERVICE, CONSENT_QUERY_SERVICE, ERASURE_COMMAND_SERVICE, ERASURE_QUERY_SERVICE, RETENTION_COMMAND_SERVICE } from "./domain/services/consent.services.js";
import { CONSENT_REPOSITORY } from "./domain/repositories/consent.repository.js";
import { ERASURE_REPOSITORY } from "./domain/repositories/erasure.repository.js";
import { RETENTION_REPOSITORY } from "./domain/repositories/retention.repository.js";
import { ConsentRepositoryImpl, ErasureRepositoryImpl, RetentionRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/consent-repositories.impl.js";
import { ConsentPersistenceAssembler, ErasurePersistenceAssembler, RetentionPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/consent-persistence.assembler.js";
import { ConsentOrmEntity, ErasureRequestOrmEntity, RetentionPolicyOrmEntity } from "./infrastructure/persistence/typeorm/entities/consent.orm-entities.js";
import { CONSENT_CONTEXT_FACADE } from "./interfaces/acl/consent-context.facade.js";
import { ConsentController } from "./interfaces/rest/controllers/consent.controller.js";
import { ErasureRequestController } from "./interfaces/rest/controllers/erasure-request.controller.js";
import { RetentionPolicyController } from "./interfaces/rest/controllers/retention-policy.controller.js";

/**
 * Consent & Compliance BC (supporting: opt-in judgment under Law 29733;
 * erasure coordinated — never executed here). Publishes
 * CONSENT_CONTEXT_FACADE (`mayProcessNow/mayContactNow/getErasureStanding`,
 * primitives-only, R12 Partnership). Imports no owner module (cycle-free:
 * owners consume this facade one-directionally; the outbound `External*`
 * adapters resolve owner facades lazily via `ModuleRef` so the module graph
 * stays acyclic).
 *
 * @author morocoders-team
 * @since 2026-10-15
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ConsentOrmEntity, ErasureRequestOrmEntity, RetentionPolicyOrmEntity]),
  ],
  controllers: [ConsentController, ErasureRequestController, RetentionPolicyController],
  providers: [
    ConsentPersistenceAssembler,
    ErasurePersistenceAssembler,
    RetentionPersistenceAssembler,
    ConsentCommandServiceImpl,
    ErasureCommandServiceImpl,
    RetentionCommandServiceImpl,
    ConsentQueryServiceImpl,
    ErasureQueryServiceImpl,
    ErasureConfirmedEventHandler,
    RevocationConfirmedEventHandler,
    ExternalIamService,
    ExternalBiometricService,
    ExternalWalletService,
    ExternalMembershipService,
    ExternalNotificationsService,
    ConsentRepositoryImpl,
    ErasureRepositoryImpl,
    RetentionRepositoryImpl,
    { provide: CONSENT_REPOSITORY, useClass: ConsentRepositoryImpl },
    { provide: ERASURE_REPOSITORY, useClass: ErasureRepositoryImpl },
    { provide: RETENTION_REPOSITORY, useClass: RetentionRepositoryImpl },
    { provide: CONSENT_COMMAND_SERVICE, useClass: ConsentCommandServiceImpl },
    { provide: ERASURE_COMMAND_SERVICE, useClass: ErasureCommandServiceImpl },
    { provide: RETENTION_COMMAND_SERVICE, useClass: RetentionCommandServiceImpl },
    { provide: CONSENT_QUERY_SERVICE, useClass: ConsentQueryServiceImpl },
    { provide: ERASURE_QUERY_SERVICE, useClass: ErasureQueryServiceImpl },
    { provide: CONSENT_CONTEXT_FACADE, useClass: ConsentContextFacadeImpl },
  ],
  exports: [CONSENT_CONTEXT_FACADE],
})
export class ConsentComplianceModule {}
