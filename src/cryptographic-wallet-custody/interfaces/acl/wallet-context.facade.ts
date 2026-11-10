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

  /**
   * Answers the Ethereum address of the person's live capability without
   * signing. Voting freezes it into authorizations so the later ecrecover
   * check compares against custody's own key.
   * @param personId Person id (`per-` prefixed string).
   */
  addressFor(personId: string): Promise<string>;

  /**
   * Erasure execution (R12): retires every non-retired capability of one
   * person. Idempotent.
   * @param personId Person id (`per-` prefixed string).
   * @returns How many capabilities were retired.
   */
  retireWalletByPerson(personId: string): Promise<number>;
}
