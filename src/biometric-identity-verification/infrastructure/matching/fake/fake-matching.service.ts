import { Injectable } from "@nestjs/common";
import type { FaceCapture, FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * In-memory matcher for tests. Always reports a perfect score; deterministic
 * and fast. The BC still applies its threshold. Selected via `FACE_MATCHER=fake`.
 */
@Injectable()
export class FakeMatchingService implements FaceMatchingService {
  async observeSimilarity(_capture: FaceCapture): Promise<{ score: number }> {
    return { score: 1 };
  }

  async forget(_reference: string): Promise<void> {
    // No vendor state to delete.
  }
}
