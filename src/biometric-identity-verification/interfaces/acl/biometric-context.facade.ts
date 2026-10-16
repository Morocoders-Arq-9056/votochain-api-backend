/**
 * Published ACL this bounded context exposes to other contexts (R3,
 * Customer/Supplier: Voting is the customer). Primitives-only at the
 * boundary. Exported from BiometricIdentityVerificationModule via
 * BIOMETRIC_CONTEXT_FACADE.
 */
export const BIOMETRIC_CONTEXT_FACADE = Symbol('BIOMETRIC_CONTEXT_FACADE');

export interface BiometricContextFacade {
  /**
   * Answers whether the person is verified now: only a fresh VERIFIED
   * verdict authorizes, within its freshness window.
   * @param personId Person id (`per-` prefixed string).
   * @param nowIso Current instant, ISO-8601.
   */
  answerVerifiedNow(personId: string, nowIso: string): Promise<{ verifiedNow: boolean; reason: string | null }>;
}
