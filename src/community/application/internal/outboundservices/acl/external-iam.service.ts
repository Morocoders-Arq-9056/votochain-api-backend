/**
 * Outbound ACL port through which Community checks identity existence in IAM
 * (UC5: an administrator is entrusted to a real person; only the reference
 * is held). Primitives-only at the boundary; this context never imports
 * IAM's value objects.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export const EXTERNAL_IAM_SERVICE = Symbol('EXTERNAL_IAM_SERVICE');

export interface ExternalIamService {
  /**
   * Answers whether a person record exists in IAM.
   * @param personId Person id (`per-` prefixed string).
   */
  personExists(personId: string): Promise<boolean>;
}
