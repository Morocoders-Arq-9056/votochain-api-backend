import { Injectable } from "@nestjs/common";
import type { ProofVerificationService } from "../../application/internal/outboundservices/proof/proof-verification.service.js";

/**
 * Production Strategy for the proof-verification port: Auth0 executes the
 * proof mechanics, IAM judges the verdict and owns the history. Sprint-01
 * binds the Fake; bind this class when Auth0 credentials are available.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class Auth0ProofAdapter implements ProofVerificationService {
  /**
   * Verifies the offered proof against Auth0 (not yet wired: throws).
   * @param userId Technical identity id under verification.
   */
  async holds(userId: string): Promise<boolean> {
    void userId;
    throw new Error("Auth0ProofAdapter not configured: bind FakeProofVerificationService in Sprint-01");
  }
}
