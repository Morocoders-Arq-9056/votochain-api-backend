import { Inject, Injectable } from "@nestjs/common";
import { GetTallyByProposalQuery } from "../../domain/model/queries/get-tally-by-proposal.query.js";
import { GetVerifiableProofByVoteQuery } from "../../domain/model/queries/get-verifiable-proof-by-vote.query.js";
import { ProposalId } from "../../domain/model/valueobjects/proposal-id.value-object.js";
import { VoteId } from "../../domain/model/valueobjects/vote-id.value-object.js";
import { PROPOSAL_QUERY_SERVICE } from "../../domain/services/proposal-query.service.js";
import type { ProposalQueryService } from "../../domain/services/proposal-query.service.js";
import { VOTE_QUERY_SERVICE } from "../../domain/services/vote-query.service.js";
import type { VoteQueryService } from "../../domain/services/vote-query.service.js";
import type { ProofAnswerDto, TallyAnswerDto, VotingContextFacade } from "../../interfaces/acl/voting-context.facade.js";

/**
 * Application implementation of the published {@link VotingContextFacade}.
 * Reserved: no internal consumer yet. Delegates to the query services and
 * translates back to primitives.
 */
@Injectable()
export class VotingContextFacadeImpl implements VotingContextFacade {
  constructor(
    @Inject(PROPOSAL_QUERY_SERVICE) private readonly proposals: ProposalQueryService,
    @Inject(VOTE_QUERY_SERVICE) private readonly votes: VoteQueryService,
  ) {}

  async getTally(proposalId: string): Promise<TallyAnswerDto | null> {
    const tally = await this.proposals.getTallyByProposal(
      new GetTallyByProposalQuery(ProposalId.of(proposalId)));
    return tally ? { counts: tally.toRecord(), turnout: tally.turnout, quorumMet: tally.quorumMet } : null;
  }

  async getProof(voteId: string): Promise<ProofAnswerDto | null> {
    const proof = await this.votes.getVerifiableProofByVote(
      new GetVerifiableProofByVoteQuery(VoteId.of(voteId)));
    return proof
      ? {
        choice: proof.choice.value,
        signature: { v: proof.signature.v, r: proof.signature.r, s: proof.signature.s },
        txHash: proof.reference?.txHash ?? null,
        recovered: proof.recovered.value,
      }
      : null;
  }
}
