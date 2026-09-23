/**
 * Outbound ACL port through which Verification asks Consent & Compliance
 * whether a person may be contacted now (opt-in judged where consent lives).
 * Sprint-01 binds the AllowAll fake; Sprint-04 binds real Consent.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const EXTERNAL_CONSENT_SERVICE = Symbol('EXTERNAL_CONSENT_SERVICE');

export interface ExternalConsentService {
  /**
   * Answers whether the person may be contacted now.
   * @param personId Person id (`per-` prefixed string).
   */
  mayContactNow(personId: string): Promise<boolean>;
}
