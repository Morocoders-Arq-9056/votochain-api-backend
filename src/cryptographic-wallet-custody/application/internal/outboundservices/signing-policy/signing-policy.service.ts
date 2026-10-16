/**
 * Strategy port: signs one digest at one path, returning the `v:r:s` wire
 * form the domain parses. Swapped via `WALLET_SIGNING_POLICY` (prod
 * `hsm`, dev/test `memory`).
 */
export const WALLET_SIGNING_POLICY = Symbol('WALLET_SIGNING_POLICY');

export interface SigningPolicy {
  /**
   * Signs the 32-byte digest and returns `v:r:s`. Forgets everything.
   * @param digest EIP-712 envelope digest to sign.
   * @param path Derivation path whose key signs.
   */
  sign(digest: Buffer, path: string): Promise<string>;
}
