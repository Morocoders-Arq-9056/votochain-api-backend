import { BiometricProfile } from "../model/aggregates/biometric-profile.aggregate.js";
import { VerificationAttempt } from "../model/aggregates/verification-attempt.aggregate.js";
import { GetAttemptHistoryByPersonQuery } from "../model/queries/get-attempt-history-by-person.query.js";
import { GetBiometricProfileByIdQuery } from "../model/queries/get-biometric-profile-by-id.query.js";
import { GetReferenceStandingByPersonQuery } from "../model/queries/get-reference-standing-by-person.query.js";
import { GetVerificationAttemptByIdQuery } from "../model/queries/get-verification-attempt-by-id.query.js";
import { GetVerificationStandingByPersonQuery } from "../model/queries/get-verification-standing-by-person.query.js";

/**
 * Domain port for biometric reads. Read-only: judges current state and
 * answers, mutates nothing.
 */
export interface BiometricQueryService {
  getVerificationStandingByPerson(
    query: GetVerificationStandingByPersonQuery,
  ): Promise<{ verifiedNow: boolean; reason: string | null }>;
  getReferenceStandingByPerson(query: GetReferenceStandingByPersonQuery): Promise<{ live: boolean }>;
  getAttemptHistoryByPerson(query: GetAttemptHistoryByPersonQuery): Promise<VerificationAttempt[]>;
  getVerificationAttemptById(query: GetVerificationAttemptByIdQuery): Promise<VerificationAttempt | null>;
  getBiometricProfileById(query: GetBiometricProfileByIdQuery): Promise<BiometricProfile | null>;
}
export const BIOMETRIC_QUERY_SERVICE = Symbol('BIOMETRIC_QUERY_SERVICE');
