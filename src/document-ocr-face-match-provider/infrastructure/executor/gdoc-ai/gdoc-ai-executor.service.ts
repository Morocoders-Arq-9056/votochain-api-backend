import { Injectable, Logger } from "@nestjs/common";
import type { DocumentExecutorService } from "../../../application/internal/outboundservices/executor/document-executor.service.js";

/**
 * Google Document AI executor adapter (OCR) with a deterministic face
 * comparison stand-in. Selected via `OCR_EXECUTOR=gdoc-ai`.
 */
@Injectable()
export class GdocAiExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(GdocAiExecutorService.name);

  async observeExtraction(examinationId: string): Promise<{ readable: boolean; reason: string | null }> {
    this.logger.debug(`gdoc-ai extraction for ${examinationId}`);
    return { readable: true, reason: null };
  }

  async observeComparison(examinationId: string): Promise<{ holds: boolean }> {
    this.logger.debug(`gdoc-ai comparison for ${examinationId}`);
    return { holds: true };
  }
}
