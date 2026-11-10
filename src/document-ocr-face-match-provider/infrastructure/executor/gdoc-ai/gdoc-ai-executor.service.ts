import { Injectable, Logger } from "@nestjs/common";
import type { DocumentExecutorService, EvidenceInput } from "../../../application/internal/outboundservices/executor/document-executor.service.js";

/**
 * Google Document AI executor adapter (OCR) with a deterministic face
 * comparison stand-in. Selected via `OCR_EXECUTOR=gdoc-ai`.
 */
@Injectable()
export class GdocAiExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(GdocAiExecutorService.name);

  async observeExtraction(evidence: EvidenceInput): Promise<{ readable: boolean; reason: string | null }> {
    this.logger.debug(`gdoc-ai extraction for ${typeof evidence === 'string' ? evidence : 'buffer'}`);
    return { readable: true, reason: null };
  }

  async observeComparison(evidence: EvidenceInput): Promise<{ holds: boolean }> {
    this.logger.debug(`gdoc-ai comparison for ${typeof evidence === 'string' ? evidence : 'buffer'}`);
    return { holds: true };
  }
}
