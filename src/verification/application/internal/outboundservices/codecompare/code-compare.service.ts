/**
 * Technology port for one-time-code comparison (executor-first).
 * Generation/comparison execute outside the Verification boundary;
 * this context only judges the verdict and owns the attempt history.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export const CODE_COMPARE_SERVICE = Symbol('CODE_COMPARE_SERVICE');

export interface CodeCompareService {
  /**
   * Renders a storable hash of a plain code. The plain code is never persisted.
   * @param plain The plain one-time code, alive only in the caller scope.
   */
  hash(plain: string): Promise<string>;

  /**
   * Judges whether a presented code matches a stored hash.
   * @param plain The presented plain code.
   * @param hash The stored hash to judge against.
   */
  matches(plain: string, hash: string): Promise<boolean>;
}
