import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentOcrFaceMatchProviderModule } from "../document-ocr-face-match-provider/document-ocr-face-match-provider.module.js";
import { BiometricContextFacadeImpl } from "./application/acl/biometric-context-facade.impl.js";
import { BiometricCommandServiceImpl } from "./application/internal/commandservices/biometric-command.service.impl.js";
import { IdentityVerifiedEventHandler } from "./application/internal/eventhandlers/identity-verified.event-handler.js";
import { ExternalConsentService } from "./application/internal/outboundservices/acl/external-consent.service.js";
import { ExternalOcrService } from "./application/internal/outboundservices/acl/external-ocr.service.js";
import { MATCHING_PORT, type FaceMatchingService } from "./application/internal/outboundservices/matching/face-matching.service.js";
import { BiometricQueryServiceImpl } from "./application/internal/queryservices/biometric-query.service.impl.js";
import { ATTEMPT_REPOSITORY } from "./domain/repositories/attempt.repository.js";
import { PROFILE_REPOSITORY } from "./domain/repositories/profile.repository.js";
import { BIOMETRIC_COMMAND_SERVICE } from "./domain/services/biometric-command.service.js";
import { BIOMETRIC_QUERY_SERVICE } from "./domain/services/biometric-query.service.js";
import { FakeMatchingService } from "./infrastructure/matching/fake/fake-matching.service.js";
import { VendorAMatchingService } from "./infrastructure/matching/vendor-a/vendor-a-matching.service.js";
import { VendorBMatchingService } from "./infrastructure/matching/vendor-b/vendor-b-matching.service.js";
import { AttemptRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/attempt-repository.impl.js";
import { ProfileRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/profile-repository.impl.js";
import { AttemptPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/attempt-persistence.assembler.js";
import { ProfilePersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/profile-persistence.assembler.js";
import { AttemptOrmEntity } from "./infrastructure/persistence/typeorm/entities/attempt.orm-entity.js";
import { ProfileOrmEntity } from "./infrastructure/persistence/typeorm/entities/profile.orm-entity.js";
import { BIOMETRIC_CONTEXT_FACADE } from "./interfaces/acl/biometric-context.facade.js";
import { BiometricController } from "./interfaces/rest/controllers/biometric.controller.js";
import { ConsentComplianceModule } from "../consent-compliance/consent-compliance.module.js";

/**
 * Biometric Identity Verification bounded context (supporting subdomain:
 * live-person proof; liveness first, then comparison, binary verdict).
 * Imports the OCR module for its published OCR_CONTEXT_FACADE (R7
 * single-use MATCH). Publishes BIOMETRIC_CONTEXT_FACADE for Voting (R3).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileOrmEntity, AttemptOrmEntity]),
    ConfigModule,
    DocumentOcrFaceMatchProviderModule,
    ConsentComplianceModule,
  ],
  controllers: [BiometricController],
  providers: [
    ProfilePersistenceAssembler,
    AttemptPersistenceAssembler,
    IdentityVerifiedEventHandler,
    ExternalOcrService,
    ExternalConsentService,
    VendorAMatchingService,
    VendorBMatchingService,
    FakeMatchingService,
    { provide: PROFILE_REPOSITORY, useClass: ProfileRepositoryImpl },
    { provide: ATTEMPT_REPOSITORY, useClass: AttemptRepositoryImpl },
    { provide: BIOMETRIC_COMMAND_SERVICE, useClass: BiometricCommandServiceImpl },
    { provide: BIOMETRIC_QUERY_SERVICE, useClass: BiometricQueryServiceImpl },
    {
      provide: MATCHING_PORT,
      inject: [ConfigService, VendorAMatchingService, VendorBMatchingService, FakeMatchingService],
      useFactory: (
        config: ConfigService,
        vendorA: VendorAMatchingService,
        vendorB: VendorBMatchingService,
        fake: FakeMatchingService,
      ): FaceMatchingService => {
        const matcher = config.get<string>('biometric.matcher', 'vendor-a');
        if (matcher === 'vendor-b') return vendorB;
        if (matcher === 'fake') return fake;
        return vendorA;
      },
    },
    { provide: BIOMETRIC_CONTEXT_FACADE, useClass: BiometricContextFacadeImpl },
  ],
  exports: [BIOMETRIC_CONTEXT_FACADE],
})
export class BiometricIdentityVerificationModule {}
