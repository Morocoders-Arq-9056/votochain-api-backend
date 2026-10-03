import { Proposal } from "../../../domain/model/aggregates/proposal.aggregate.js";
import type { VoteAuthorization } from "../../../domain/model/aggregates/vote-authorization.aggregate.js";
import type { VerifiableProof } from "../../../domain/model/valueobjects/verifiable-proof.value-object.js";
import { VoterReceipt } from "../../../domain/model/valueobjects/voter-receipt.value-object.js";
import { AuthorizationResource } from "../resources/authorization.resource.js";
import { ProofResource } from "../resources/proof.resource.js";
import { ProposalResource } from "../resources/proposal.resource.js";
import { TallyResource } from "../resources/tally.resource.js";
import { VoteReceiptResource } from "../resources/vote-receipt.resource.js";

export class VotingResourceFromEntityAssembler {
  static toProposalResource(proposal: Proposal): ProposalResource {
    const tally = proposal.tally;
    return new ProposalResource(
      proposal.id.value,
      proposal.communityId.value,
      proposal.status,
      proposal.options.values,
      proposal.quorum ? { threshold: proposal.quorum.threshold, basis: proposal.quorum.basis } : null,
      tally ? { counts: tally.toRecord(), turnout: tally.turnout, quorumMet: tally.quorumMet } : null,
    );
  }

  static toTallyResource(proposalId: string, counts: Record<string, number>, turnout: number, quorumMet: boolean): TallyResource {
    return new TallyResource(proposalId, counts, turnout, quorumMet);
  }

  static toAuthorizationResource(auth: VoteAuthorization): AuthorizationResource {
    return new AuthorizationResource(auth.id.value, auth.proposalId.value, auth.voterAddress.value, auth.status, auth.expiresAt);
  }

  static toReceiptResource(receipt: VoterReceipt): VoteReceiptResource {
    return new VoteReceiptResource(receipt.voteId.value, receipt.proposalId.value,
      receipt.voterAddress.value, receipt.choice.value, receipt.status, receipt.txHash);
  }

  /**
   * Rebuilds the receipt resource from a proof. Both carry typed identity,
   * so no re-parsing is needed.
   * @param proof Verifiable proof just read back.
   */
  static toReceiptResourceFromProof(proof: VerifiableProof): VoteReceiptResource {
    return this.toReceiptResource(VoterReceipt.from({
      voteId: proof.voteId,
      proposalId: proof.proposalId,
      voterAddress: proof.recovered,
      choice: proof.choice,
      status: proof.status,
      txHash: proof.reference?.txHash ?? null,
    }));
  }

  static toProofResource(proof: VerifiableProof): ProofResource {
    return new ProofResource(proof.voteId.value, proof.proposalId.value, proof.choice.value,
      { v: proof.signature.v, r: proof.signature.r, s: proof.signature.s },
      proof.reference?.txHash ?? null, proof.reference?.blockNumber ?? null,
      proof.recovered.value, proof.status);
  }
}
