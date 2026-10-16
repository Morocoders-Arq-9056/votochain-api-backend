import { Inject, Injectable } from "@nestjs/common";
import { BIOMETRIC_CONTEXT_FACADE, type BiometricContextFacade } from "../../../../../biometric-identity-verification/interfaces/acl/biometric-context.facade.js";

/**
 * Outbound ACL toward the biometric-identity-verification BC: liveness
 * verdict at request time (R3, Customer/Supplier). Consumes the real
 * `BIOMETRIC_CONTEXT_FACADE.answerVerifiedNow` — only a fresh VERIFIED
 * verdict authorizes. No infrastructure of this context implements it.
 */
@Injectable()
export class ExternalBiometricService {
  constructor(@Inject(BIOMETRIC_CONTEXT_FACADE) private readonly facade: BiometricContextFacade) {}

  /**
   * Answers whether a fresh VERIFIED verdict stands for the person now.
   * @param personId Person id (`per-` prefixed string).
   */
  async isVerifiedNow(personId: string): Promise<{ verifiedNow: boolean }> {
    const answer = await this.facade.answerVerifiedNow(personId, new Date().toISOString());
    return { verifiedNow: answer.verifiedNow };
  }
}
