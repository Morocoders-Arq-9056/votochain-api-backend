import { VoteAuthorization } from "../model/aggregates/vote-authorization.aggregate.js";
import { AuthorizationId } from "../model/valueobjects/authorization-id.value-object.js";
import { ProposalId } from "../model/valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../model/valueobjects/voter-address.value-object.js";

export const AUTHORIZATION_REPOSITORY = Symbol('AUTHORIZATION_REPOSITORY');

export interface VoteAuthorizationRepository {
  findById(id: AuthorizationId): Promise<VoteAuthorization | null>;
  findPendingByProposalAndVoter(proposalId: ProposalId, voter: VoterAddress): Promise<VoteAuthorization | null>;
  save(auth: VoteAuthorization): Promise<void>;
}
