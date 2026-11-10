import { Injectable } from "@nestjs/common";
import type { PasswordHasherService } from "../../../application/internal/outboundservices/hashing/password-hasher.service.js";

/**
 * Test-only hasher: deterministic, fast, never for production.
 */
@Injectable()
export class FakePasswordHasherService implements PasswordHasherService {
  async hash(plain: string): Promise<string> {
    return `fake$${plain}`;
  }

  async matches(plain: string, hash: string): Promise<boolean> {
    return hash === `fake$${plain}`;
  }
}
