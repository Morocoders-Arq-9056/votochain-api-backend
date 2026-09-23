import { VerificationChallenge } from "../model/aggregates/verification-challenge.aggregate.js";
import { GetChallengeHistoryByPersonAndPurposeQuery } from "../model/queries/get-challenge-history-by-person-and-purpose.query.js";
import { GetChallengeStandingByPersonAndPurposeQuery } from "../model/queries/get-challenge-standing-by-person-and-purpose.query.js";

/**
 * Interface for the verification query service.
 * This service is responsible for handling queries related to verification challenges.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export interface VerificationQueryService {
  /**
   * Answers the standing of the challenge for a person and purpose.
   * Backed by the aggregate's answering operation; mutates nothing, emits nothing.
   *
   * @param query the query containing the person and purpose.
   * @returns a promise that resolves to usability and remaining attempts.
   */
  getChallengeStandingByPersonAndPurpose(query: GetChallengeStandingByPersonAndPurposeQuery): Promise<{ usable: boolean; remaining: number }>;

  /**
   * Handles the retrieval of the challenge history for a person and purpose.
   * Returns all persisted challenges for the pair in any standing, ordered by requestedAt.
   *
   * @param query the query containing the person and purpose.
   * @returns a promise that resolves to the ordered challenges.
   */
  getChallengeHistoryByPersonAndPurpose(query: GetChallengeHistoryByPersonAndPurposeQuery): Promise<VerificationChallenge[]>;
}
export const VERIFICATION_QUERY_SERVICE = Symbol('VERIFICATION_QUERY_SERVICE');
