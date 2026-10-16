import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyTypedData } from "ethers";
import type { SignaturePolicy } from "../../../application/internal/outboundservices/signing/signature-policy.service.js";

/**
 * Real EIP-712 signature verification (Sprint-03): rebuilds the same vote
 * envelope the Wallet custody ceremony signed and `ecrecover`s the signer.
 * `recovered.equals(voter)` is enforced by the domain (`Vote.cast`).
 */
@Injectable()
export class EthersSignatureVerificationService implements SignaturePolicy {
  constructor(private readonly config: ConfigService) {}

  /**
   * Recovers the signer address from the signed vote content.
   * @param contentRef Vote content that was signed.
   * @param sig Wire signature `v:r:s` the domain parses.
   */
  async recoverSigner(contentRef: string, sig: string): Promise<string> {
    const parts = (sig ?? '').split(':');
    if (parts.length !== 3) throw new Error('invalid signature encoding');
    const v = Number(parts[0]);
    if (!Number.isInteger(v)) throw new Error('invalid signature v');
    const chainId = this.config.get<number>('wallet.chainId', 80002);
    const recovered = verifyTypedData(
      { name: 'VotoChain', version: '1', chainId },
      { Vote: [{ name: 'content', type: 'string' }] },
      { content: contentRef },
      { r: parts[1], s: parts[2], v },
    );
    return recovered.toLowerCase();
  }
}
