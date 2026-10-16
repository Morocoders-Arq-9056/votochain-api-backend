import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypedDataEncoder, getBytes } from "ethers";
import type { KeyCustodyService } from "../../../application/internal/outboundservices/kms/key-custody.service.js";
import { WALLET_DERIVATION_STRATEGY, type KeyDerivationStrategy } from "../../../application/internal/outboundservices/key-derivation/key-derivation.service.js";
import { WALLET_SIGNING_POLICY, type SigningPolicy } from "../../../application/internal/outboundservices/signing-policy/signing-policy.service.js";
import { VOTE_TYPED_DATA_TYPES, votocoinEip712Domain } from "../eip712/eip712-envelope.js";

/**
 * HD custody ceremony: renders the path, hashes the EIP-712 vote envelope,
 * signs transiently, and discards everything the same tick. Memory-only —
 * nothing signable ever rests here.
 */
@Injectable()
export class HdKeyCustodyService implements KeyCustodyService {
  constructor(
    @Inject(WALLET_DERIVATION_STRATEGY) private readonly derivation: KeyDerivationStrategy,
    @Inject(WALLET_SIGNING_POLICY) private readonly policy: SigningPolicy,
    private readonly config: ConfigService,
  ) {}

  async signTransient(personId: string, position: number, contentRef: string): Promise<string> {
    const path = this.derivation.derivePath(personId, position);
    const chainId = this.config.get<number>('wallet.chainId', 80002);
    const digest = TypedDataEncoder.hash(votocoinEip712Domain(chainId), VOTE_TYPED_DATA_TYPES, {
      content: contentRef,
    });
    return this.policy.sign(Buffer.from(getBytes(digest)), path);
  }
}
