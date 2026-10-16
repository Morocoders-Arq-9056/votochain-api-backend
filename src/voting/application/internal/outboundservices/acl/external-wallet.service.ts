import { Inject, Injectable } from "@nestjs/common";
import { WALLET_CONTEXT_FACADE, type WalletContextFacade } from "../../../../../cryptographic-wallet-custody/interfaces/acl/wallet-context.facade.js";

/**
 * Outbound ACL toward the cryptographic-wallet-custody BC: signing of the
 * assembled message content (R4, Customer/Supplier). Only the signature
 * travels back; the wallet never sees domain objects. Reconstruct →
 * sign transient → forget, memory-only.
 */
@Injectable()
export class ExternalWalletService {
  constructor(@Inject(WALLET_CONTEXT_FACADE) private readonly facade: WalletContextFacade) {}

  /**
   * Signs one vote content with the person's live capability.
   * @param personId Person id (`per-` prefixed string).
   * @param contentRef Message content being signed.
   * @returns `v:r:s` signature triple the domain parses.
   */
  async sign(personId: string, contentRef: string): Promise<string> {
    return this.facade.sign(personId, contentRef);
  }
}
