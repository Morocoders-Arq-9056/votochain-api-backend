import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Signature, SigningKey, computeAddress, getBytes, keccak256, toUtf8Bytes } from 'ethers';
import type { SigningPolicy } from '../../../../application/internal/outboundservices/signing-policy/signing-policy.service.js';

/**
 * Seeded signing policy (free, $0). Derives the ceremony key from the
 * platform-secret master seed plus the path and signs, forgetting everything
 * the same tick. No KMS — the seed is the platform secret (env/secret manager)
 * cifrado en reposo. Selected via `WALLET_SIGNING_POLICY=seeded`.
 */
@Injectable()
export class SeededSigningPolicyService implements SigningPolicy {
  private readonly logger = new Logger(SeededSigningPolicyService.name);

  constructor(private readonly config: ConfigService) {}

  async sign(digest: Buffer, path: string): Promise<string> {
    const seed = this.config.get<string>('wallet.masterSeed', '');
    if (!seed) throw new Error('seeded seed unavailable: set WALLET_MASTER_SEED (platform secret, 32+ chars)');
    this.logger.debug(`seeded sign at ${path}`);
    const signingKey = new SigningKey(keccak256(toUtf8Bytes(`votachain-seeded:${seed}:${path}`)));
    const signature = Signature.from(signingKey.sign(getBytes(digest)));
    return `${signature.v}:${signature.r}:${signature.s}`;
  }

  async address(path: string): Promise<string> {
    const seed = this.config.get<string>('wallet.masterSeed', '');
    if (!seed) throw new Error('seeded seed unavailable: set WALLET_MASTER_SEED (platform secret, 32+ chars)');
    return computeAddress(
      new SigningKey(keccak256(toUtf8Bytes(`votachain-seeded:${seed}:${path}`))),
    ).toLowerCase();
  }
}
