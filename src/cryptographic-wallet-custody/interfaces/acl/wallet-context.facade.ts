/**
 * Published ACL this bounded context exposes to other contexts (R4,
 * Customer/Supplier: Voting is the customer). Primitives-only at the
 * boundary. Exported from CryptographicWalletCustodyModule via
 * WALLET_CONTEXT_FACADE.
 */
export const WALLET_CONTEXT_FACADE = Symbol('WALLET_CONTEXT_FACADE');

export interface WalletContextFacade {
  /**
   * Signs one vote content with the person's live capability: reconstruct →
   * sign transient → forget, memory-only. One content crosses; nothing that
   * could sign on its own ever crosses.
   * @param personId Person id (`per-` prefixed string).
   * @param contentRef Vote content to sign.
   */
  sign(personId: string, contentRef: string): Promise<string>;

  /**
   * Answers whether the person may sign now, plus the capability reference.
   * @param personId Person id (`per-` prefixed string).
   */
  answerCapability(personId: string): Promise<{ maySign: boolean; walletId: string | null; position: number | null }>;
}
