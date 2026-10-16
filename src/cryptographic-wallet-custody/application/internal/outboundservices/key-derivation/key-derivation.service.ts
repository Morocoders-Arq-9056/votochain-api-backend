/**
 * Strategy port: renders the derivation path for one capability. `hd`
 * renders the BIP-32 path; `test` renders a fixed test path. Swapped via
 * `WALLET_DERIVATION_STRATEGY` — no `if (env)` in the service.
 */
export const WALLET_DERIVATION_STRATEGY = Symbol('WALLET_DERIVATION_STRATEGY');

export interface KeyDerivationStrategy {
  /**
   * Renders the derivation path for the person's position.
   * @param personId Person holding the capability.
   * @param position Allocated derivation position.
   */
  derivePath(personId: string, position: number): string;
}
