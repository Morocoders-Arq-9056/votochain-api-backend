import { keccak256, solidityPacked } from 'ethers';

export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return '0x' + '0'.repeat(64);
  let level = [...leaves].sort();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(keccak256(solidityPacked(['bytes32', 'bytes32'], [left, right])));
    }
    level = next;
  }
  return level[0];
}
