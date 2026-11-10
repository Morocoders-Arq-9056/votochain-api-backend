import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { PasswordHasherService } from "../../../application/internal/outboundservices/hashing/password-hasher.service.js";

function scryptKey(
  plain: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/**
 * Production password hasher over `node:crypto` scrypt (no native deps).
 * Format: `scrypt$N$r$p$saltHex$hashHex` (N=16384, r=8, p=1, keylen=64).
 */
@Injectable()
export class ScryptPasswordHasherService implements PasswordHasherService {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scryptKey(plain, salt, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async matches(plain: string, hash: string): Promise<boolean> {
    try {
      const [, n, r, p, saltHex, hashHex] = hash.split('$');
      if (!n || !r || !p || !saltHex || !hashHex) return false;
      const derived = await scryptKey(
        plain, Buffer.from(saltHex, 'hex'), Buffer.from(hashHex, 'hex').length,
        { N: Number(n), r: Number(r), p: Number(p) },
      );
      const expected = Buffer.from(hashHex, 'hex');
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
}
