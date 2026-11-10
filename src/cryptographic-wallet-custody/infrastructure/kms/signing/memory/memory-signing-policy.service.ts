import { Injectable } from "@nestjs/common";
import { Signature, SigningKey, computeAddress, getBytes, keccak256, toUtf8Bytes } from "ethers";
import type { SigningPolicy } from "../../../../application/internal/outboundservices/signing-policy/signing-policy.service.js";

/**
 * In-memory signing for dev/test: derives a deterministic key from the
 * path, signs the digest, and forgets everything in the same tick. Never
 * persists, caches or logs key material. Selected via
 * `WALLET_SIGNING_POLICY=memory`.
 */
@Injectable()
export class MemorySigningPolicyService implements SigningPolicy {
  async sign(digest: Buffer, path: string): Promise<string> {
    const signingKey = new SigningKey(this.keyFor(path));
    const signature = Signature.from(signingKey.sign(getBytes(digest)));
    const wire = `${signature.v}:${signature.r}:${signature.s}`;
    return wire;
  }

  async address(path: string): Promise<string> {
    return computeAddress(new SigningKey(this.keyFor(path))).toLowerCase();
  }

  private keyFor(path: string): string {
    return keccak256(toUtf8Bytes(`votachain-test-key:${path}`));
  }
}
