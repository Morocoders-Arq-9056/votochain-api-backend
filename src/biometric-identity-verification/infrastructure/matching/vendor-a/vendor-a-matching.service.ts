import { Injectable, Logger } from "@nestjs/common";
import type { FaceCapture, FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * Vendor-A face matcher. Reports a fixed similarity score; the BC judges it
 * against its own `FACE_MATCH_THRESHOLD` — the bar never leaves this
 * context. Selected via `FACE_MATCHER=vendor-a`.
 */
@Injectable()
export class VendorAMatchingService implements FaceMatchingService {
  private readonly logger = new Logger(VendorAMatchingService.name);

  async observeSimilarity(capture: FaceCapture): Promise<{ score: number }> {
    const score = 0.95;
    this.logger.debug(`vendor-a score=${score} for ${capture.attemptId}`);
    return { score };
  }

  async forget(_reference: string): Promise<void> {
    // No vendor state to delete.
  }
}
