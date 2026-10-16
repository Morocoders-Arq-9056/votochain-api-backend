/**
 * EIP-712 envelope for signing vote content. The wallet custody ceremony
 * signs `{ content }` with these types, and Voting recovers the signer with
 * identical values (R4). Only `chainId` varies, always from config, and it
 * must match between signer and verifier.
 */
export const VOTE_TYPED_DATA_TYPES: Record<string, { name: string; type: string }[]> = {
  Vote: [{ name: 'content', type: 'string' }],
};

export function votocoinEip712Domain(chainId: number): { name: string; version: string; chainId: number } {
  return { name: 'VotoChain', version: '1', chainId };
}
