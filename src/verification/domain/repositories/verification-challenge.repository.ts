import { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { VerificationChallenge } from "../model/aggregates/verification-challenge.aggregate.js";
import { ChallengeId } from "../model/valueobjects/challenge-id.value-object.js";
import { Purpose } from "../model/valueobjects/purpose.value-object.js";

/**
 * Interface for the verification challenge repository.
 * This repository is responsible for managing verification challenge persistence and retrieval.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
export interface VerificationChallengeRepository {
  /**
   * Finds a challenge by its unique identifier.
   *
   * @param id The unique identifier of the challenge to find.
   * @returns A promise that resolves to the challenge if found, or null if not found.
   */
  findById(id: ChallengeId): Promise<VerificationChallenge | null>;

  /**
   * Finds the OPEN challenge for a person and purpose, if any.
   * At most one OPEN challenge exists per pair; the partial unique index is the backstop.
   *
   * @param personId The person identifier.
   * @param purpose The purpose of the proof.
   * @returns A promise that resolves to the open challenge if found, or null if not found.
   */
  findOpenByPersonAndPurpose(personId: PersonId, purpose: Purpose): Promise<VerificationChallenge | null>;

  /**
   * Finds all challenges for a person and purpose in any standing, ordered by requestedAt.
   * Serves the scrutiny history need; never contains secrets.
   *
   * @param personId The person identifier.
   * @param purpose The purpose of the proof.
   * @returns A promise that resolves to the ordered challenges.
   */
  findAllByPersonAndPurpose(personId: PersonId, purpose: Purpose): Promise<VerificationChallenge[]>;

  /**
   * Saves a verification challenge to the repository.
   *
   * @param challenge The challenge to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  save(challenge: VerificationChallenge): Promise<void>;
}
export const VERIFICATION_CHALLENGE_REPOSITORY = Symbol('VERIFICATION_CHALLENGE_REPOSITORY');
