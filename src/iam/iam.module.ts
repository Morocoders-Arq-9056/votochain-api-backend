import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserCommandServiceImpl } from "./application/internal/commandservices/user-command.service.impl.js";
import { UserQueryServiceImpl } from "./application/internal/queryservices/user-query.service.impl.js";
import { IamContextFacadeImpl } from "./application/acl/iam-context-facade.impl.js";
import { UserEventLogger } from "./application/internal/eventhandlers/user-event-logger.js";
import { USER_COMMAND_SERVICE } from "./domain/services/user-command.service.js";
import { USER_QUERY_SERVICE } from "./domain/services/user-query.service.js";
import { USER_REPOSITORY } from "./domain/repositories/user.repository.js";
import { PROOF_VERIFICATION_SERVICE } from "./application/internal/outboundservices/proof/proof-verification.service.js";
import { SESSION_ARTIFACT_SERVICE } from "./application/internal/outboundservices/session/session-artifact.service.js";
import { EXTERNAL_NOTIFICATIONS_SERVICE } from "./application/internal/outboundservices/acl/external-notifications.service.js";
import { AuthenticationController } from "./interfaces/rest/controllers/authentication.controller.js";
import { IAM_CONTEXT_FACADE } from "./interfaces/acl/iam-context.facade.js";
import { UserRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/user-repository.impl.js";
import { UserPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/user-persistence.assembler.js";
import { UserOrmEntity } from "./infrastructure/persistence/typeorm/entities/user.orm-entity.js";
import { FakeProofVerificationService } from "./infrastructure/auth0/fake-proof-verification.service.js";
import { NoopSessionArtifactService } from "./infrastructure/session/noop-session-artifact.service.js";
import { LogOnlyNotificationsFacade } from "./infrastructure/notifications/log-only-notifications.facade.js";

/**
 * IAM bounded context module (supporting subdomain).
 *
 * Wires the four DDD layers: interfaces (REST + published facade),
 * application (command/query services, ACL facade impl, event fan-out),
 * domain (ports) and infrastructure (TypeORM adapter, Sprint-01 fakes).
 * Sprint-01 binds Fake/Noop/LogOnly adapters; swap via `useClass` for prod.
 * Publishes IAM_CONTEXT_FACADE for Membership/Community/Verification (R9/R13).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [AuthenticationController],
  providers: [
    UserPersistenceAssembler,
    UserCommandServiceImpl,
    UserQueryServiceImpl,
    IamContextFacadeImpl,
    UserEventLogger,
    { provide: USER_REPOSITORY, useClass: UserRepositoryImpl },
    { provide: USER_COMMAND_SERVICE, useClass: UserCommandServiceImpl },
    { provide: USER_QUERY_SERVICE, useClass: UserQueryServiceImpl },
    { provide: PROOF_VERIFICATION_SERVICE, useClass: FakeProofVerificationService },
    { provide: SESSION_ARTIFACT_SERVICE, useClass: NoopSessionArtifactService },
    { provide: EXTERNAL_NOTIFICATIONS_SERVICE, useClass: LogOnlyNotificationsFacade },
    { provide: IAM_CONTEXT_FACADE, useClass: IamContextFacadeImpl },
  ],
  exports: [IAM_CONTEXT_FACADE],
})
export class IamModule {}
