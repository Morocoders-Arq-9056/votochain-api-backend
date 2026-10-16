import { Injectable } from "@nestjs/common";
import type { FaceMatchingService } from "../../../application/internal/outboundservices/matching/face-matching.service.js";

/**
 * In-memory matcher for tests. Always judges a match; deterministic and
 * fast. Selected via `FACE_MATCHER=fake`.
 */
@Injectable()
export class FakeMatchingService implements FaceMatchingService {
  async judgesMatch(_attemptId: string): Promise<boolean> {
    return true;
  }
}
