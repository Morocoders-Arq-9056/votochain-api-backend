import { Injectable } from "@nestjs/common";
import type { CodeCompareService } from "../../../application/internal/outboundservices/codecompare/code-compare.service.js";

/**
 * Test-only strategy for the code-compare port (Sprint-01 fake, kept as
 * test double). Deterministic reversible transform — never production.
 * Swapped via `{ provide: CODE_COMPARE_SERVICE, useClass: ... }`,
 * never via `if (mock)` inside the application service.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class FakeCodeCompareService implements CodeCompareService {
  async hash(plain: string): Promise<string> {
    return `fake:${plain}`;
  }

  async matches(plain: string, hash: string): Promise<boolean> {
    return hash === `fake:${plain}`;
  }
}
