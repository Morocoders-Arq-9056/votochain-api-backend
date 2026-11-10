import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import type { DocumentExecutorService, EvidenceInput } from '../../../application/internal/outboundservices/executor/document-executor.service.js';
import type { DocumentEvidence } from '../../../application/internal/outboundservices/evidence/document-evidence.js';
import { DniFieldParser } from './dni-field.parser.js';

function isDocumentEvidence(input: EvidenceInput): input is DocumentEvidence {
  return typeof input === 'object' && input !== null && Buffer.isBuffer((input as DocumentEvidence).buffer);
}

@Injectable()
export class AzureDocumentIntelligenceExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(AzureDocumentIntelligenceExecutorService.name);
  private readonly parser = new DniFieldParser();

  constructor(private readonly config: ConfigService) {}

  private buildClient(): DocumentAnalysisClient {
    const endpoint = this.config.get<string>('azure.documentIntelligence.endpoint', '');
    const key = this.config.get<string>('azure.documentIntelligence.key', '');
    if (!endpoint) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is required');
    if (!key) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_KEY is required (use Entra ID via DefaultAzureCredential for prod without key)');
    return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  }

  async observeExtraction(evidence: EvidenceInput): Promise<{ readable: boolean; reason: string | null }> {
    if (!isDocumentEvidence(evidence)) {
      this.logger.warn(`observeExtraction called without buffer (examinationId=${String(evidence)}): degrading to readable=true for legacy/tests`);
      return { readable: true, reason: null };
    }
    const client = this.buildClient();
    const modelId = this.config.get<string>('azure.documentIntelligence.model', 'prebuilt-read');
    try {
      const poller = await client.beginAnalyzeDocument(modelId, evidence.buffer);
      const result = await poller.pollUntilDone();
      const parsed = this.parser.parse(evidence.documentType, result as unknown as never);
      this.logger.debug(`azure extraction readable=${parsed.readable} reason=${parsed.reason} words=${parsed.rawTextLength} avgConf=${parsed.averageWordConfidence.toFixed(2)}`);
      return { readable: parsed.readable, reason: parsed.reason };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`azure extraction failed: ${msg}`);
      // Fail closed as UNREADABLE/BLURRY so domain can record verdict; caller maps to UnreadableReason
      return { readable: false, reason: 'BLURRY' };
    }
  }

  async observeComparison(evidence: EvidenceInput): Promise<{ holds: boolean }> {
    // Comparison (face vs portrait) is biometrics, not OCR. Until Sprint-05's
    // portrait-vs-selfie wiring lands, degrade gracefully.
    if (!isDocumentEvidence(evidence)) {
      this.logger.debug(`observeComparison without buffer (examinationId=${String(evidence)}): holds=true (degraded)`);
      return { holds: true };
    }
    // With buffer, the OCR executor has no face model — delegate to Rekognition
    // comparison in Sprint-05 is expected to run via the OCR BC's Rekognition
    // path. Until then, readable documents are considered holds.
    this.logger.debug(`observeComparison: no face model in OCR BC, holds=true (Sprint-05 will wire Rekognition CompareFaces)`);
    return { holds: true };
  }
}
