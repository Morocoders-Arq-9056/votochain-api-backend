import { Injectable } from "@nestjs/common";

/**
 * Outbound ACL toward the cryptographic-wallet-custody BC: signing of the
 * assembled message content (R4, Customer/Supplier). Only the signature
 * travels back; the wallet never sees domain objects. No infrastructure of
 * this context may implement it: this consumer is the whole ACL until the
 * Wallet facade exists.
 * TECH-DEBT: Sprint-02 fake — signs any content with the constant
 * `'fake-sig'`. Deleted in Sprint-03 when the real wallet lands.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalWalletService {
  async sign(_walletHint: string | null, _contentRef: string): Promise<string> {
    return 'fake-sig';
  }
}
