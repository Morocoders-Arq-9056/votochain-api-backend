/**
 * Technology port: custody ceremony (derive + sign transiently).
 *
 * `signTransient` signs one vote content with the capability's derived key
 * and discards the material in the same tick — it never persists, caches or
 * logs signing material. The position travels explicitly: custody cannot
 * resolve a position from an id without persistence concerns.
 */
export const KEY_CUSTODY_SERVICE = Symbol('KEY_CUSTODY_SERVICE');

export interface KeyCustodyService {
  /**
   * Signs the content with the key at the given position and forgets it.
   * @param personId Person holding the capability.
   * @param position Allocated derivation position.
   * @param contentRef Vote content, EIP-712 enveloped.
   */
  signTransient(personId: string, position: number, contentRef: string): Promise<string>;
}
