import { Inject, Injectable } from "@nestjs/common";
import { GetTallyByProposalQuery } from "../../domain/model/queries/get-tally-by-proposal.query.js";
import { GetVerifiableProofByVoteQuery } from "../../domain/model/queries/get-verifiable-proof-by-vote.query.js";
import { MarkVoteConfirmedCommand } from "../../domain/model/commands/mark-vote-confirmed.command.js";
import { ProposalId } from "../../domain/model/valueobjects/proposal-id.value-object.js";
import { TransactionReference } from "../../domain/model/valueobjects/transaction-reference.value-object.js";
import { VoteId } from "../../domain/model/valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../../domain/model/valueobjects/voter-address.value-object.js";
import { PROPOSAL_QUERY_SERVICE } from "../../domain/services/proposal-query.service.js";
import type { ProposalQueryService } from "../../domain/services/proposal-query.service.js";
import { VOTE_COMMAND_SERVICE } from "../../domain/services/vote-command.service.js";
import type { VoteCommandService } from "../../domain/services/vote-command.service.js";
import { VOTE_QUERY_SERVICE } from "../../domain/services/vote-query.service.js";
import type { VoteQueryService } from "../../domain/services/vote-query.service.js";
import { VOTE_REPOSITORY } from "../../domain/repositories/vote.repository.js";
import type { VoteRepository } from "../../domain/repositories/vote.repository.js";
import type { ProofAnswerDto, TallyAnswerDto, VotingContextFacade } from "../../interfaces/acl/voting-context.facade.js";
import { SignedVoteEnvelope } from "../../../shared/domain/model/valueobjects/signed-vote-envelope.value-object.js";

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
    @Inject(VOTE_REPOSITORY) private readonly voteRepo: VoteRepository,
    @Inject(VOTE_COMMAND_SERVICE) private readonly voteCommands: VoteCommandService,
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

  async confirmVoteByEnvelope(input: { envelopeWire: string; txHash: string; blockNumber: number }): Promise<void> {
    const envelope = SignedVoteEnvelope.fromWire(input.envelopeWire);
    const vote = await this.voteRepo.findByProposalAndVoter(
      ProposalId.of(envelope.proposalId),
      VoterAddress.of(envelope.voter),
    );
    if (!vote) throw new Error(`vote not found for proposal ${envelope.proposalId} voter ${envelope.voter}`);
    const ref = TransactionReference.of({ txHash: input.txHash, blockNumber: input.blockNumber });
    await this.voteCommands.markVoteConfirmed(new MarkVoteConfirmedCommand(vote.id, ref, input.blockNumber));
  }
}
