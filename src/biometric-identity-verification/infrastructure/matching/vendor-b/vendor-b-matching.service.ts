import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * Vendor-B face matcher (lower baseline score than Vendor-A). Same port,
 * same BC-owned threshold discipline. Selected via `FACE_MATCHER=vendor-b`.
 */
@Injectable()
export class VendorBMatchingService implements FaceMatchingService {
  private readonly logger = new Logger(VendorBMatchingService.name);

  constructor(private readonly config: ConfigService) {}

  async judgesMatch(attemptId: string): Promise<boolean> {
    const score = this.observeScore(attemptId);
    const threshold = this.config.get<number>('biometric.matchThreshold', 0.82);
    const match = score >= threshold;
    this.logger.debug(`vendor-b score=${score} threshold=${threshold} match=${match} for ${attemptId}`);
    return match;
  }

  private observeScore(_attemptId: string): number {
    return 0.97;
  }
}
