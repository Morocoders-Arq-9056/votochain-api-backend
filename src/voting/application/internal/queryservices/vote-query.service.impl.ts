import { Inject, Injectable } from "@nestjs/common";
import { SIGNATURE_POLICY } from "../outboundservices/signing/signature-policy.service.js";
import type { SignaturePolicy } from "../outboundservices/signing/signature-policy.service.js";
import { Vote } from "../../../domain/model/aggregates/vote.aggregate.js";
import { GetVerifiableProofByVoteQuery } from "../../../domain/model/queries/get-verifiable-proof-by-vote.query.js";
import { GetVoterReceiptByProposalAndVoterQuery } from "../../../domain/model/queries/get-voter-receipt-by-proposal-and-voter.query.js";
import { VerifiableProof } from "../../../domain/model/valueobjects/verifiable-proof.value-object.js";
import { VoterAddress } from "../../../domain/model/valueobjects/voter-address.value-object.js";
import { VoterReceipt } from "../../../domain/model/valueobjects/voter-receipt.value-object.js";
import { VOTE_REPOSITORY } from "../../../domain/repositories/vote.repository.js";
import type { VoteRepository } from "../../../domain/repositories/vote.repository.js";
import { VoteQueryService } from "../../../domain/services/vote-query.service.js";

/**
 * Read-side application service: voter receipt (my journey only) and
 * verifiable proof (choice + signature + tx + recovered signer).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class VoteQueryServiceImpl implements VoteQueryService {
  constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(SIGNATURE_POLICY) private readonly signatures: SignaturePolicy,
  ) {}

  async getVoterReceiptByProposalAndVoter(query: GetVoterReceiptByProposalAndVoterQuery): Promise<VoterReceipt | null> {
    const vote = await this.votes.findByProposalAndVoter(query.proposalId, query.voterAddress);
    return vote ? this.toReceipt(vote) : null;
  }

  async getVerifiableProofByVote(query: GetVerifiableProofByVoteQuery): Promise<VerifiableProof | null> {
    const vote = await this.votes.findById(query.voteId);
    if (!vote) return null;
    const contentRef = Vote.buildMessage(vote.proposalId, vote.voterAddress, vote.choice, vote.nonce);
    const recovered = VoterAddress.of(await this.signatures.recoverSigner(contentRef, vote.signature.toString()));
    return VerifiableProof.from({
      voteId: vote.id,
      proposalId: vote.proposalId,
      choice: vote.choice,
      signature: vote.signature,
      reference: vote.reference,
      recovered,
      status: vote.status,
    });
  }

  private toReceipt(vote: Vote): VoterReceipt {
    return VoterReceipt.from({
      voteId: vote.id,
      proposalId: vote.proposalId,
      voterAddress: vote.voterAddress,
      choice: vote.choice,
      status: vote.status,
      txHash: vote.reference?.txHash ?? null,
    });
  }
}
