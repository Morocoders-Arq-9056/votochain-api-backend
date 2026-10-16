import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Signature, SigningKey, getBytes, keccak256, toUtf8Bytes } from "ethers";
import type { SigningPolicy } from "../../../../application/internal/outboundservices/signing-policy/signing-policy.service.js";

/**
 * HSM signing policy (prod). Derives the ceremony key from the KMS-bound
 * master seed plus the path and signs, forgetting everything in the same
 * tick. The real KMS call (e.g. AWS KMS `Sign` with `WALLET_KMS_KEY_ID`)
 * replaces the local derivation without changing the port. Requires
 * `WALLET_MASTER_SEED` (or KMS wiring). Selected via
 * `WALLET_SIGNING_POLICY=hsm`.
 */
@Injectable()
export class HsmSigningPolicyService implements SigningPolicy {
  private readonly logger = new Logger(HsmSigningPolicyService.name);

  constructor(private readonly config: ConfigService) {}

  async sign(digest: Buffer, path: string): Promise<string> {
    const seed = this.config.get<string>('wallet.masterSeed', '');
    if (!seed) throw new Error('KMS seed unavailable: set WALLET_MASTER_SEED or wire WALLET_KMS_KEY_ID');
    this.logger.debug(`hsm sign at ${path} via ${this.config.get<string>('wallet.kmsKeyId', 'local-seed')}`);
    const signingKey = new SigningKey(keccak256(toUtf8Bytes(`votachain-hsm:${seed}:${path}`)));
    const signature = Signature.from(signingKey.sign(getBytes(digest)));
    return `${signature.v}:${signature.r}:${signature.s}`;
  }
}
