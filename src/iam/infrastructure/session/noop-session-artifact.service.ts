import { Injectable } from "@nestjs/common";
import type { SessionArtifactService } from "../../application/internal/outboundservices/session/session-artifact.service.js";

/**
 * Sprint-01 no-op session-artifact executor: issue/end resolve immediately.
 * The domain facts remain the source of truth; artifact mechanics are
 * instructed to the external executor in production.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class NoopSessionArtifactService implements SessionArtifactService {
  /**
   * No-op issue instruction.
   * @param _userId Ignored technical identity id.
   */
  async issue(_userId: string): Promise<void> {
    return undefined;
  }

  /**
   * No-op end instruction.
   * @param _userId Ignored technical identity id.
   * @param _reason Ignored sign-out reason.
   */
  async end(_userId: string, _reason: string): Promise<void> {
    return undefined;
  }
}
