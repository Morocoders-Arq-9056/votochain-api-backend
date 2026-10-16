import { Inject, Injectable, Optional } from "@nestjs/common";
import { CONSENT_CONTEXT_FACADE } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";
import type { ConsentContextFacade } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";

/**
 * Outbound ACL through which Verification asks Consent & Compliance whether
 * a person may be contacted now (R12). Sprint-04 real gate: opt-out — delivery
 * is allowed unless an explicit EMAIL_NOTIFICATIONS revocation stands.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ExternalConsentService {
  constructor(
    @Optional() @Inject(CONSENT_CONTEXT_FACADE) private readonly consent?: ConsentContextFacade,
  ) {}

  /**
   * Answers whether the person may be contacted now.
   * @param personId Person id (`per-` prefixed string).
   */
  async mayContactNow(personId: string): Promise<boolean> {
    if (!this.consent) return true;
    try {
      return await this.consent.mayContactNow(personId);
    } catch {
      return true;
    }
  }
}
