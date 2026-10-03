import { Injectable } from "@nestjs/common";

/**
 * Outbound ACL toward the biometric-identity-verification BC: liveness
 * verdict at request time (R3, Customer/Supplier). No infrastructure of
 * this context may implement it: this consumer is the whole ACL until the
 * Biometric facade exists.
 * TECH-DEBT: Sprint-02 fake — every check returns verifiedNow `true`.
 * Deleted in Sprint-03 when the real biometric gate lands.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalBiometricService {
  async isVerifiedNow(_personId: string): Promise<{ verifiedNow: boolean }> {
    return { verifiedNow: true };
  }
}
