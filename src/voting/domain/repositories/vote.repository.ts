import { Vote } from "../model/aggregates/vote.aggregate.js";
import { ProposalId } from "../model/valueobjects/proposal-id.value-object.js";
import { VoteId } from "../model/valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../model/valueobjects/voter-address.value-object.js";

export const VOTE_REPOSITORY = Symbol('VOTE_REPOSITORY');

export interface VoteRepository {
  findById(id: VoteId): Promise<Vote | null>;
  findByProposalAndVoter(proposalId: ProposalId, voter: VoterAddress): Promise<Vote | null>;
  findConfirmedByProposal(proposalId: ProposalId): Promise<Vote[]>;
  save(vote: Vote): Promise<void>;
}
