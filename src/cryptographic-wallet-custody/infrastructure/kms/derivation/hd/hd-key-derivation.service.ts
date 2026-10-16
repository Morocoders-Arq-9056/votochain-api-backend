import { Injectable } from "@nestjs/common";
import type { KeyDerivationStrategy } from "../../../../application/internal/outboundservices/key-derivation/key-derivation.service.js";

/**
 * Production derivation: standard Ethereum BIP-32 path per position. The
 * position guarantees uniqueness; the personId is carried for ceremony
 * auditing at the caller.
 */
@Injectable()
export class HdKeyDerivationService implements KeyDerivationStrategy {
  derivePath(_personId: string, position: number): string {
    return `m/44'/60'/0'/0/${position}`;
  }
}
