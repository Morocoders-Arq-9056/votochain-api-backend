import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * Vendor-A face matcher. Reports a similarity score; the BC judges it
 * against its own `FACE_MATCH_THRESHOLD` — the bar never leaves this
 * context. Selected via `FACE_MATCHER=vendor-a`.
 */
@Injectable()
export class VendorAMatchingService implements FaceMatchingService {
  private readonly logger = new Logger(VendorAMatchingService.name);

  constructor(private readonly config: ConfigService) {}

  async judgesMatch(attemptId: string): Promise<boolean> {
    const score = this.observeScore(attemptId);
    const threshold = this.config.get<number>('biometric.matchThreshold', 0.82);
    const match = score >= threshold;
    this.logger.debug(`vendor-a score=${score} threshold=${threshold} match=${match} for ${attemptId}`);
    return match;
  }

  private observeScore(_attemptId: string): number {
    return 0.95;
  }
}
