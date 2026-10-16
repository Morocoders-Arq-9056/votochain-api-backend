/**
 * Technology port: recovers the signer address from signed content.
 * The domain only compares `recovered.equals(declared)` — it never
 * implements recovery. Sprint-03 binds the real EIP-712 ecrecover policy.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export const SIGNATURE_POLICY = Symbol('SIGNATURE_POLICY');

export interface SignaturePolicy {
  recoverSigner(contentRef: string, sig: string): Promise<string>;
}
