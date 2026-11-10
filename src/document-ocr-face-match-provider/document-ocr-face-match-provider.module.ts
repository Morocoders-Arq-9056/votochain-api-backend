import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MembershipModule } from "../membership/membership.module.js";
import { OcrContextFacadeImpl } from "./application/acl/ocr-context-facade.impl.js";
import { ExaminationCommandServiceImpl } from "./application/internal/commandservices/examination-command.service.impl.js";
import { ExaminationEventLogger } from "./application/internal/eventhandlers/examination-event.logger.js";
import { ExternalConsentService } from "./application/internal/outboundservices/acl/external-consent.service.js";
import { ExternalMembershipService } from "./application/internal/outboundservices/acl/external-membership.service.js";
import { EXECUTOR_PORT, type DocumentExecutorService } from "./application/internal/outboundservices/executor/document-executor.service.js";
import { EVIDENCE_STORE } from "./application/internal/outboundservices/evidence/evidence-store.service.js";
import { InMemoryEvidenceStore } from "./infrastructure/evidence/in-memory/in-memory-evidence.store.js";
import { AzureDocumentIntelligenceExecutorService } from "./infrastructure/executor/azure-document-intelligence/azure-document-intelligence.executor.service.js";
import { ExaminationQueryServiceImpl } from "./application/internal/queryservices/examination-query.service.impl.js";
import { EXAMINATION_COMMAND_SERVICE } from "./domain/services/examination-command.service.js";
import { EXAMINATION_QUERY_SERVICE } from "./domain/services/examination-query.service.js";
import { EXAMINATION_REPOSITORY } from "./domain/repositories/examination.repository.js";
import { GdocAiExecutorService } from "./infrastructure/executor/gdoc-ai/gdoc-ai-executor.service.js";
import { RekognitionExecutorService } from "./infrastructure/executor/rekognition/rekognition-executor.service.js";
import { ExaminationRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/examination-repository.impl.js";
import { ExaminationPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/examination-persistence.assembler.js";
import { ExaminationOrmEntity } from "./infrastructure/persistence/typeorm/entities/examination.orm-entity.js";
import { OCR_CONTEXT_FACADE } from "./interfaces/acl/ocr-context.facade.js";
import { ExaminationController } from "./interfaces/rest/controllers/examination.controller.js";
import { ConsentComplianceModule } from "../consent-compliance/consent-compliance.module.js";

/**
 * Document OCR & Face Match Provider bounded context (generic subdomain:
 * one document proof → single verdict). The executor is interchangeable
 * behind EXECUTOR_PORT (`OCR_EXECUTOR`). Imports MembershipModule for its
 * published MEMBERSHIP_CONTEXT_FACADE (R8 belonging precondition).
 * Publishes OCR_CONTEXT_FACADE for Biometric (R7 single-use MATCH).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ExaminationOrmEntity]),
    ConfigModule,
    MembershipModule,
    ConsentComplianceModule,
  ],
  controllers: [ExaminationController],
  providers: [
    ExaminationPersistenceAssembler,
    ExaminationEventLogger,
    ExternalMembershipService,
    ExternalConsentService,
    RekognitionExecutorService,
    GdocAiExecutorService,
    AzureDocumentIntelligenceExecutorService,
    InMemoryEvidenceStore,
    { provide: EVIDENCE_STORE, useExisting: InMemoryEvidenceStore },
    { provide: EXAMINATION_REPOSITORY, useClass: ExaminationRepositoryImpl },
    { provide: EXAMINATION_COMMAND_SERVICE, useClass: ExaminationCommandServiceImpl },
    { provide: EXAMINATION_QUERY_SERVICE, useClass: ExaminationQueryServiceImpl },
    {
      provide: EXECUTOR_PORT,
      inject: [ConfigService, AzureDocumentIntelligenceExecutorService, RekognitionExecutorService, GdocAiExecutorService],
      useFactory: (
        config: ConfigService,
        azure: AzureDocumentIntelligenceExecutorService,
        rekognition: RekognitionExecutorService,
        gdocAi: GdocAiExecutorService,
      ): DocumentExecutorService => {
        const executor = config.get<string>('ocr.executor', 'azure-document-intelligence');
        if (executor === 'gdoc-ai') return gdocAi;
        if (executor === 'rekognition') return rekognition;
        return azure;
      },
    },
    { provide: OCR_CONTEXT_FACADE, useClass: OcrContextFacadeImpl },
  ],
  exports: [OCR_CONTEXT_FACADE],
})
export class DocumentOcrFaceMatchProviderModule {}
