import { Inject, Injectable, Optional } from "@nestjs/common";
import { CONSENT_CONTEXT_FACADE } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";
import type { ConsentContextFacade } from "../../../../../consent-compliance/interfaces/acl/consent-context.facade.js";

/**
 * Outbound ACL through which Notifications judges the may-contact gate owned
 * by Consent & Compliance (R12 Partnership). Sprint-04 real gate: refusals
 * persist as REFUSED history, never silent drops. Without the facade (isolated
 * tests) it allows — production always wires the real Consent module.
 */
@Injectable()
export class ExternalConsentService {
  constructor(
    @Optional() @Inject(CONSENT_CONTEXT_FACADE) private readonly consent?: ConsentContextFacade,
  ) {}

  /**
   * Answers whether the address may be contacted now.
   * @param address Destination address (email shape string).
   */
  async mayContactNow(address: string): Promise<boolean> {
    if (!this.consent) return true;
    try {
      return await this.consent.mayContactNow(address);
    } catch {
      return true;
    }
  }
}
