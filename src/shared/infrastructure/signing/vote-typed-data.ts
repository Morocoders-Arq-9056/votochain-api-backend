import { keccak256, toUtf8Bytes } from 'ethers';
import type { SignedVoteEnvelope } from '../../domain/model/valueobjects/signed-vote-envelope.value-object.js';

export const VOTE_TYPED_DATA_TYPES = {
  Vote: [
    { name: 'proposalId', type: 'bytes32' },
    { name: 'voter', type: 'address' },
    { name: 'choiceCommitment', type: 'bytes32' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export function votocoinEip712Domain(chainId: number): { name: string; version: string; chainId: number } {
  return { name: 'VotoChain', version: '1', chainId };
}

export function proposalIdHash(proposalId: string): string {
  return keccak256(toUtf8Bytes(proposalId));
}

export function voteNonceHash(nonce: string): string {
  return keccak256(toUtf8Bytes(nonce));
}

export function toTypedVoteValue(envelope: SignedVoteEnvelope): {
  proposalId: string;
  voter: string;
  choiceCommitment: string;
  nonce: string;
} {
  return {
    proposalId: proposalIdHash(envelope.proposalId),
    voter: envelope.voter,
    choiceCommitment: envelope.choiceCommitment,
    nonce: voteNonceHash(envelope.nonce),
  };
}
