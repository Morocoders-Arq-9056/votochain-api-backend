import { VoteAuthorization } from "../model/aggregates/vote-authorization.aggregate.js";
import { AuthorizationId } from "../model/valueobjects/authorization-id.value-object.js";
import { ProposalId } from "../model/valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../model/valueobjects/voter-address.value-object.js";

export const AUTHORIZATION_REPOSITORY = Symbol('AUTHORIZATION_REPOSITORY');

export interface VoteAuthorizationRepository {
  findById(id: AuthorizationId): Promise<VoteAuthorization | null>;
  findPendingByProposalAndVoter(proposalId: ProposalId, voter: VoterAddress): Promise<VoteAuthorization | null>;

  /**
   * Finds PENDING authorizations whose validity window already elapsed
   * (erasure-sweep + expiry maintenance input). Bounded by the caller.
   * @param now Reference instant; rows with `expiresAt <= now` match.
   * @param limit Maximum rows per sweep tick.
   */
  findExpiredPending(now: Date, limit: number): Promise<VoteAuthorization[]>;

  save(auth: VoteAuthorization): Promise<void>;
}
