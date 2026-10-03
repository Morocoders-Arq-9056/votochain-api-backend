import { GetVerifiableProofByVoteQuery } from "../model/queries/get-verifiable-proof-by-vote.query.js";
import { GetVoterReceiptByProposalAndVoterQuery } from "../model/queries/get-voter-receipt-by-proposal-and-voter.query.js";
import type { VerifiableProof } from "../model/valueobjects/verifiable-proof.value-object.js";
import type { VoterReceipt } from "../model/valueobjects/voter-receipt.value-object.js";

export const VOTE_QUERY_SERVICE = Symbol('VOTE_QUERY_SERVICE');

/**
 * Domain port for vote reads (voter receipt, verifiable proof).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */

export interface VoteQueryService {
  getVoterReceiptByProposalAndVoter(query: GetVoterReceiptByProposalAndVoterQuery): Promise<VoterReceipt | null>;
  getVerifiableProofByVote(query: GetVerifiableProofByVoteQuery): Promise<VerifiableProof | null>;
}
