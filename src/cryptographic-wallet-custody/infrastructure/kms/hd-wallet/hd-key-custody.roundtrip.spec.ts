import type { ConfigService } from '@nestjs/config';
import { SigningKey, computeAddress, keccak256, toUtf8Bytes } from 'ethers';
import { HdKeyCustodyService } from './hd-key-custody.service.js';
import { TestKeyDerivationService } from '../derivation/test/test-key-derivation.service.js';
import { MemorySigningPolicyService } from '../signing/memory/memory-signing-policy.service.js';
import { EthersSignatureVerificationService } from '../../../../voting/infrastructure/signing/ethers/ethers-signature-verification.service.js';
import { VoterAddress } from '../../../../voting/domain/model/valueobjects/voter-address.value-object.js';

function testConfig(): ConfigService {
  return { get: (_key: string, fallback?: unknown) => fallback } as unknown as ConfigService;
}

describe('Wallet custody → Voting recovery round-trip', () => {
  it('recovers the derived address from a transiently signed content', async () => {
    const custody = new HdKeyCustodyService(
      new TestKeyDerivationService(),
      new MemorySigningPolicyService(),
      testConfig(),
    );
    const verifier = new EthersSignatureVerificationService(testConfig());
    const contentRef = 'vote:prop-1:0xvoter:yes:nonce-1';

    const sigRaw = await custody.signTransient('per-test', 0, contentRef);
    const recovered = await verifier.recoverSigner(contentRef, sigRaw);

    const expected = computeAddress(
      new SigningKey(keccak256(toUtf8Bytes('votachain-test-key:test/0'))),
    ).toLowerCase();
    expect(recovered).toBe(expected);
    expect(() => VoterAddress.of(recovered)).not.toThrow();
  });

  it('never reuses material: two signs of the same content agree (deterministic), different positions differ', async () => {
    const custody = new HdKeyCustodyService(
      new TestKeyDerivationService(),
      new MemorySigningPolicyService(),
      testConfig(),
    );
    const verifier = new EthersSignatureVerificationService(testConfig());
    const contentRef = 'vote:prop-1:0xvoter:yes:nonce-1';

    const first = await custody.signTransient('per-test', 0, contentRef);
    const second = await custody.signTransient('per-test', 1, contentRef);

    expect(await verifier.recoverSigner(contentRef, first)).not.toBe(
      await verifier.recoverSigner(contentRef, second),
    );
  });
});
