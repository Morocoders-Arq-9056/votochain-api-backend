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

  /**
   * Answers the Ethereum address of the key at the path without signing.
   * Public by design (it lands on-chain with every vote); key material
   * never leaves.
   * @param path Derivation path whose address is answered.
   */
  address(path: string): Promise<string>;
}
