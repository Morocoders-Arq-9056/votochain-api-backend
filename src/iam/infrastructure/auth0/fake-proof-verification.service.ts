import { Injectable } from "@nestjs/common";
import type { ProofVerificationService } from "../../application/internal/outboundservices/proof/proof-verification.service.js";

/**
 * Sprint-01 fake: every offered proof holds. Keeps unit speed and removes
 * the Auth0 dependency from the slice. Swap via
 * `{ provide: PROOF_VERIFICATION_SERVICE, useClass: ... }` — never `if(mock)`
 * inside service implementations. Kept afterwards as the test double.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class FakeProofVerificationService implements ProofVerificationService {
  /**
   * Always resolves true regardless of the user.
   * @param _userId Ignored technical identity id.
   */
  async holds(_userId: string): Promise<boolean> {
    return true;
  }

  /**
   * Accepts the rotated secret without persisting it (fake executor).
   * @param _userId Ignored technical identity id.
   * @param _newSecret Ignored plain secret.
   */
  async applySecret(_userId: string, _newSecret: string): Promise<void> {
    return;
  }
}
