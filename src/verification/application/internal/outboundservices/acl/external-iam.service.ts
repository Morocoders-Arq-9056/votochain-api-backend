/**
 * Outbound ACL port through which Verification checks identity existence
 * and publishes confirmation facts to IAM (R9). Primitives-only at the
 * boundary; this context never imports IAM's value objects.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const EXTERNAL_IAM_SERVICE = Symbol('EXTERNAL_IAM_SERVICE');

export interface ExternalIamService {
  /**
   * Answers whether a person record exists in IAM.
   * @param personId Person id (`per-` prefixed string).
   */
  personExists(personId: string): Promise<boolean>;

  /**
   * Records the observed channel confirmation (R9 fact-only, never secret).
   * The handler routes by purpose first; IAM only ever sees email-verification.
   * @param personId Person id (`per-` prefixed string).
   */
  markVerified(personId: string): Promise<void>;
}
