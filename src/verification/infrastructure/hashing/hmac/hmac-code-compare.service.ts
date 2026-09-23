import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { CodeCompareService } from "../../../application/internal/outboundservices/codecompare/code-compare.service.js";

/**
 * Production strategy for the code-compare port: HMAC-SHA256.
 * OTPs are short-lived (5 min) and attempt-capped (5); deterministic,
 * fast, dependency-free. The secret lives outside the database
 * (`verification.otp.hmac-secret`) and is rotated out of band.
 * Instantiated by the module factory, never by Nest directly.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class HmacCodeCompareService implements CodeCompareService {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('hmac secret required');
  }

  async hash(plain: string): Promise<string> {
    return createHmac('sha256', this.secret).update(plain, 'utf8').digest('hex');
  }

  async matches(plain: string, hash: string): Promise<boolean> {
    if (!plain || !hash) return false;
    const probe = Buffer.from(await this.hash(plain), 'hex');
    const expected = Buffer.from(hash, 'hex');
    return probe.length === expected.length && timingSafeEqual(probe, expected);
  }
}
