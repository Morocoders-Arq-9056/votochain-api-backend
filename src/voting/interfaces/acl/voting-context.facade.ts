/**
 * Published ACL this bounded context exposes to other contexts.
 * Primitives-only at the boundary. No internal consumer yet — reads are
 * consumed by the UI; Reporting is the first future consumer.
 */
export const VOTING_CONTEXT_FACADE = Symbol('VOTING_CONTEXT_FACADE');

export interface TallyAnswerDto {
  counts: Record<string, number>;
  turnout: number;
  quorumMet: boolean;
}

export interface ProofAnswerDto {
  choice: string;
  signature: { v: number; r: string; s: string };
  txHash: string | null;
  recovered: string;
}

export interface VotingContextFacade {
  getTally(proposalId: string): Promise<TallyAnswerDto | null>;
  getProof(voteId: string): Promise<ProofAnswerDto | null>;
  confirmVoteByEnvelope(input: { envelopeWire: string; txHash: string; blockNumber: number }): Promise<void>;
}
