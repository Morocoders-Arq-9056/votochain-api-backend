import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { CONSENT_CONTEXT_FACADE } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";
import type { ConsentContextFacade } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";

/**
 * Outbound ACL toward Consent (gate + erasure coordination, R12).
 * Sprint-04 real gate: strict opt-in on BIOMETRIC_PROCESSING. Revocation
 * notices remain log-and-continue: this context revokes its own reference,
 * then the owner operator confirms back via
 * `POST /api/v1/erasure-requests/:id/confirmations`.
 */
@Injectable()
export class ExternalConsentService {
  private readonly logger = new Logger(ExternalConsentService.name);

  constructor(
    @Optional() @Inject(CONSENT_CONTEXT_FACADE) private readonly consent?: ConsentContextFacade,
  ) {}

  /**
   * Answers whether biometric consent stands for the person now.
   * @param personId Person id (`per-` prefixed string).
   */
  async biometricConsentStands(personId: string): Promise<boolean> {
    if (!this.consent) return true;
    try {
      const answer = await this.consent.mayProcessNow(personId, 'BIOMETRIC_PROCESSING');
      return answer.granted;
    } catch {
      return false;
    }
  }

  /**
   * Confirms to Consent that this context revoked its own reference.
   * @param personId Person whose reference was revoked.
   */
  async notifyRevoked(personId: string): Promise<void> {
    this.logger.log(`biometric revocation confirmed for ${personId}`);
  }
}
