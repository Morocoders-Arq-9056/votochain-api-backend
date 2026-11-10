import { AbiCoder, keccak256 } from 'ethers';

const CODER = AbiCoder.defaultAbiCoder();

export function computeChoiceCommitment(choice: number, salt: string): string {
  if (!Number.isInteger(choice) || choice < 0 || choice > 255) throw new Error('choice out of range 0..255');
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt ?? '')) throw new Error('salt must be 32 bytes hex 0x...');
  return keccak256(CODER.encode(['uint8', 'bytes32'], [choice, salt]));
}
