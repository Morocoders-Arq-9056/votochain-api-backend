import { Injectable } from "@nestjs/common";

/**
 * Outbound ACL through which Verification asks Consent & Compliance whether
 * a person may be contacted now. Consent is another bounded context, so no
 * infrastructure of this context may implement it: this consumer is the
 * whole ACL until the Consent facade exists. Allow-all by default; replaced
 * by a facade call in Sprint-04.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ExternalConsentService {
  /**
   * Answers whether the person may be contacted now.
   * @param personId Person id (`per-` prefixed string).
   */
  async mayContactNow(_personId: string): Promise<boolean> {
    return true;
  }
}
