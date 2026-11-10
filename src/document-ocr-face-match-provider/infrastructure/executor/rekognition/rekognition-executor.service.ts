import { Injectable, Logger } from "@nestjs/common";
import type { DocumentExecutorService, EvidenceInput } from "../../../application/internal/outboundservices/executor/document-executor.service.js";

/**
 * AWS Rekognition executor adapter (face comparison of enrollment).
 * Kept as STUB until Sprint-05 wires CompareFaces/IndexFaces with real bytes.
 */
@Injectable()
export class RekognitionExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(RekognitionExecutorService.name);

  async observeExtraction(evidence: EvidenceInput): Promise<{ readable: boolean; reason: string | null }> {
    this.logger.debug(`rekognition extraction for ${typeof evidence === 'string' ? evidence : 'buffer'}`);
    return { readable: true, reason: null };
  }

  async observeComparison(evidence: EvidenceInput): Promise<{ holds: boolean }> {
    this.logger.debug(`rekognition comparison for ${typeof evidence === 'string' ? evidence : 'buffer'}`);
    return { holds: true };
  }
}
