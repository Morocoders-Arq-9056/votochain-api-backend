import { Inject, Injectable, Optional } from "@nestjs/common";
import { CONSENT_CONTEXT_FACADE } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";
import type { ConsentContextFacade } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";

/**
 * Outbound ACL toward Consent (gate, R12). Sprint-04 real gate: document
 * examination with face handling falls under the BIOMETRIC_PROCESSING scope
 * (scope catalog ownership is a carried open question). Strict opt-in —
 * refusals answer 403 `ConsentRequired`, never silent.
 */
@Injectable()
export class ExternalConsentService {
  constructor(
    @Optional() @Inject(CONSENT_CONTEXT_FACADE) private readonly consent?: ConsentContextFacade,
  ) {}

  /**
   * Answers whether the person's data may be processed now.
   * @param personId Person id (`per-` prefixed string).
   */
  async mayProcessNow(personId: string): Promise<boolean> {
    if (!this.consent) return true;
    try {
      const answer = await this.consent.mayProcessNow(personId, 'BIOMETRIC_PROCESSING');
      return answer.granted;
    } catch {
      return false;
    }
  }
}
