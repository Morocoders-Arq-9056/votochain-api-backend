import { Injectable } from "@nestjs/common";
import type { SignaturePolicy } from "../../../application/internal/outboundservices/signing/signature-policy.service.js";

/**
 * Sprint-02 fake: echoes the declared voter parsed from the contentRef
 * `vote:proposal:voter:choice:nonce` segment [2]. Sprint-03 lands the real
 * EIP-712 ecrecover.
 */
@Injectable()
export class FakeSignaturePolicyService implements SignaturePolicy {
  async recoverSigner(contentRef: string, _sig: string): Promise<string> {
    const voter = contentRef.split(':')[2];
    if (!voter) throw new Error('unparseable contentRef');
    return voter;
  }
}
