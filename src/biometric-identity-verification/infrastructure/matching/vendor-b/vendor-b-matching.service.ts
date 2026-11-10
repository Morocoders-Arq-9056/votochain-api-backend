import { Injectable, Logger } from "@nestjs/common";
import type { FaceCapture, FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * Vendor-B face matcher (higher baseline score than Vendor-A). Same port,
 * same BC-owned threshold discipline. Selected via `FACE_MATCHER=vendor-b`.
 */
@Injectable()
export class VendorBMatchingService implements FaceMatchingService {
  private readonly logger = new Logger(VendorBMatchingService.name);

  async observeSimilarity(capture: FaceCapture): Promise<{ score: number }> {
    const score = 0.97;
    this.logger.debug(`vendor-b score=${score} for ${capture.attemptId}`);
    return { score };
  }

  async forget(_reference: string): Promise<void> {
    // No vendor state to delete.
  }
}
