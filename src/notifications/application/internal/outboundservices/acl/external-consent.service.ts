import { Injectable } from "@nestjs/common";

/**
 * Outbound ACL through which Notifications judges the may-contact gate owned
 * by Consent & Compliance. Consent is another bounded context, so no
 * infrastructure of this context may implement it: this consumer is the
 * whole ACL until the Consent facade exists. Allow-all by default; replaced
 * by a facade call in Sprint-04. The gate is judged BEFORE the unit of
 * work; refusals persist as REFUSED history, never silent drops.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalConsentService {
  /**
   * Answers whether the address may be contacted now.
   * @param address Destination address (email shape string).
   */
  async mayContactNow(_address: string): Promise<boolean> {
    void _address;
    return true;
  }
}
