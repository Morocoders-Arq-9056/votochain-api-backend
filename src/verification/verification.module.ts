import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module.js";
import { VerificationCommandServiceImpl } from "./application/internal/commandservices/verification-command.service.impl.js";
import { VerificationQueryServiceImpl } from "./application/internal/queryservices/verification-query.service.impl.js";
import { ChallengeConfirmedEventHandler } from "./application/internal/eventhandlers/challenge-confirmed.event-handler.js";
import { VerificationContextFacadeImpl } from "./application/acl/verification-context-facade.impl.js";
import { ChallengesController } from "./interfaces/rest/controllers/challenges.controller.js";
import { AnswersController } from "./interfaces/rest/controllers/answers.controller.js";
import { VERIFICATION_CONTEXT_FACADE } from "./interfaces/acl/verification-context.facade.js";
import { VERIFICATION_COMMAND_SERVICE } from "./domain/services/verification-command.service.js";
import { VERIFICATION_QUERY_SERVICE } from "./domain/services/verification-query.service.js";
import { VERIFICATION_CHALLENGE_REPOSITORY } from "./domain/repositories/verification-challenge.repository.js";
import { CODE_COMPARE_SERVICE } from "./application/internal/outboundservices/codecompare/code-compare.service.js";
import { EXTERNAL_CONSENT_SERVICE } from "./application/internal/outboundservices/acl/external-consent.service.js";
import { EXTERNAL_IAM_SERVICE } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { EXTERNAL_NOTIFICATIONS_SERVICE } from "./application/internal/outboundservices/acl/external-notifications.service.js";
import { ChallengeRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/challenge-repository.impl.js";
import { ChallengePersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/challenge-persistence.assembler.js";
import { ChallengeOrmEntity } from "./infrastructure/persistence/typeorm/entities/challenge.orm-entity.js";
import { HmacCodeCompareService } from "./infrastructure/hashing/hmac/hmac-code-compare.service.js";
import { FakeCodeCompareService } from "./infrastructure/hashing/fake/fake-code-compare.service.js";
import { ExternalIamServiceImpl } from "./infrastructure/iam/external-iam.service.js";
import { AllowAllConsentService } from "./infrastructure/consent/allow-all-consent.service.js";
import { LogOnlyNotificationsService } from "./infrastructure/notifications/log-only-notifications.service.js";

/**
 * Verification bounded context module (generic subdomain: channel proof).
 *
 * Wires the four DDD layers: application (command/query services, confirmed
 * handler, outbound ACL ports), domain (ports) and infrastructure (TypeORM
 * adapter, HMAC compare, Sprint-01 fakes) and interfaces (REST controller,
 * published facade). `IamModule` is imported for the
 * published `IAM_CONTEXT_FACADE` token (R9, ACL direction Verification→IAM).
 * Sprint-01 binds Fake/AllowAll/LogOnly adapters; swap via `useClass`.
 * `CODE_COMPARE_SERVICE` swaps on `verification.otp.hasher` (`hmac` default).
 * Publishes VERIFICATION_CONTEXT_FACADE for channel-proof consumers.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Module({
  imports: [TypeOrmModule.forFeature([ChallengeOrmEntity]), IamModule],
  controllers: [ChallengesController, AnswersController],
  providers: [
    ChallengePersistenceAssembler,
    VerificationCommandServiceImpl,
    VerificationQueryServiceImpl,
    ChallengeConfirmedEventHandler,
    VerificationContextFacadeImpl,
    ExternalIamServiceImpl,
    AllowAllConsentService,
    LogOnlyNotificationsService,
    { provide: VERIFICATION_CHALLENGE_REPOSITORY, useClass: ChallengeRepositoryImpl },
    { provide: VERIFICATION_COMMAND_SERVICE, useClass: VerificationCommandServiceImpl },
    { provide: VERIFICATION_QUERY_SERVICE, useClass: VerificationQueryServiceImpl },
    { provide: EXTERNAL_IAM_SERVICE, useClass: ExternalIamServiceImpl },
    { provide: EXTERNAL_CONSENT_SERVICE, useClass: AllowAllConsentService },
    { provide: EXTERNAL_NOTIFICATIONS_SERVICE, useClass: LogOnlyNotificationsService },
    { provide: VERIFICATION_CONTEXT_FACADE, useClass: VerificationContextFacadeImpl },
    {
      provide: CODE_COMPARE_SERVICE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        if (cfg.get<string>('verification.otp.hasher', 'hmac') === 'fake')
          return new FakeCodeCompareService();
        return new HmacCodeCompareService(cfg.getOrThrow<string>('verification.otp.hmacSecret'));
      },
    },
  ],
  exports: [VERIFICATION_CONTEXT_FACADE],
})
export class VerificationModule {}
