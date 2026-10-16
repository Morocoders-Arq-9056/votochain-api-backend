import { VerificationAttempt } from "../model/aggregates/verification-attempt.aggregate.js";
import { BiometricProfileId } from "../model/valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../model/valueobjects/verification-attempt-id.value-object.js";

/** Persistence port for the VerificationAttempt aggregate root. */
export interface AttemptRepository {
  findById(id: VerificationAttemptId): Promise<VerificationAttempt | null>;
  findLatestByPerson(personId: PersonId): Promise<VerificationAttempt | null>;
  findAllByPerson(personId: PersonId): Promise<VerificationAttempt[]>;
  findOpenByProfile(profileId: BiometricProfileId): Promise<VerificationAttempt[]>;
  save(attempt: VerificationAttempt): Promise<void>;
}
export const ATTEMPT_REPOSITORY = Symbol('ATTEMPT_REPOSITORY');
