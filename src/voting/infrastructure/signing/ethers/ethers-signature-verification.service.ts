import { Injectable, Logger } from "@nestjs/common";
import type { SignaturePolicy } from "../../../application/internal/outboundservices/signing/signature-policy.service.js";

/**
 * Real EIP-712 verification stub. Same echo shape as the fake for now;
 * TODO Sprint-03: rebuild typed-data and `ecrecover` via ethers here.
 */
@Injectable()
export class EthersSignatureVerificationService implements SignaturePolicy {
  private readonly logger = new Logger(EthersSignatureVerificationService.name);

  async recoverSigner(contentRef: string, _sig: string): Promise<string> {
    this.logger.warn('ethers ecrecover not yet implemented (Sprint-03); echoing declared voter');
    const voter = contentRef.split(':')[2];
    if (!voter) throw new Error('unparseable contentRef');
    return voter;
  }
}
