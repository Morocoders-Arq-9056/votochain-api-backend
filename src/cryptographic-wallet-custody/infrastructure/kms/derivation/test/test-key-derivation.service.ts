import { Injectable } from "@nestjs/common";
import type { KeyDerivationStrategy } from "../../../../application/internal/outboundservices/key-derivation/key-derivation.service.js";

/**
 * Test derivation: fixed path per position, position-unique without real HD
 * math. Dev/test only (`WALLET_DERIVATION_STRATEGY=test`).
 */
@Injectable()
export class TestKeyDerivationService implements KeyDerivationStrategy {
  derivePath(_personId: string, position: number): string {
    return `test/${position}`;
  }
}
