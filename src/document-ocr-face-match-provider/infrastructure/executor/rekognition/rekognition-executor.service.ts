import { Injectable, Logger } from "@nestjs/common";
import type { DocumentExecutorService } from "../../../application/internal/outboundservices/executor/document-executor.service.js";

/**
 * AWS Rekognition executor adapter. Sprint-03 has no image-ingestion
 * pipeline yet, so the vendor observations are deterministic stand-ins; the
 * port and the domain pipeline are exercised end-to-end. Swapping the
 * executor is a one-line `providers` change (`OCR_EXECUTOR`).
 */
@Injectable()
export class RekognitionExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(RekognitionExecutorService.name);

  async observeExtraction(examinationId: string): Promise<{ readable: boolean; reason: string | null }> {
    this.logger.debug(`rekognition extraction for ${examinationId}`);
    return { readable: true, reason: null };
  }

  async observeComparison(examinationId: string): Promise<{ holds: boolean }> {
    this.logger.debug(`rekognition comparison for ${examinationId}`);
    return { holds: true };
  }
}
