import { Inject, Injectable } from "@nestjs/common";
import { VerificationAttempt } from "../../../domain/model/aggregates/verification-attempt.aggregate.js";
import { GetAttemptHistoryByPersonQuery } from "../../../domain/model/queries/get-attempt-history-by-person.query.js";
import { GetBiometricProfileByIdQuery } from "../../../domain/model/queries/get-biometric-profile-by-id.query.js";
import { GetReferenceStandingByPersonQuery } from "../../../domain/model/queries/get-reference-standing-by-person.query.js";
import { GetVerificationAttemptByIdQuery } from "../../../domain/model/queries/get-verification-attempt-by-id.query.js";
import { GetVerificationStandingByPersonQuery } from "../../../domain/model/queries/get-verification-standing-by-person.query.js";
import type { BiometricProfile } from "../../../domain/model/aggregates/biometric-profile.aggregate.js";
import { ATTEMPT_REPOSITORY } from "../../../domain/repositories/attempt.repository.js";
import type { AttemptRepository } from "../../../domain/repositories/attempt.repository.js";
import { PROFILE_REPOSITORY } from "../../../domain/repositories/profile.repository.js";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository.js";
import type { BiometricQueryService } from "../../../domain/services/biometric-query.service.js";

/**
 * Read-only query service. Only a fresh `VERIFIED` authorizes; an aged-out
 * verdict answers with a reason instead. No mutations, no events.
 */
@Injectable()
export class BiometricQueryServiceImpl implements BiometricQueryService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
  ) {}

  async getVerificationStandingByPerson(
    query: GetVerificationStandingByPersonQuery,
  ): Promise<{ verifiedNow: boolean; reason: string | null }> {
    const latest = await this.attempts.findLatestByPerson(query.personId);
    if (!latest) return { verifiedNow: false, reason: 'NO_ATTEMPT' };
    return latest.answerStanding(query.now);
  }

  async getReferenceStandingByPerson(query: GetReferenceStandingByPersonQuery): Promise<{ live: boolean }> {
    const ref = await this.profiles.findLiveByPerson(query.personId);
    return ref ? ref.answerReferenceStanding() : { live: false };
  }

  async getAttemptHistoryByPerson(query: GetAttemptHistoryByPersonQuery): Promise<VerificationAttempt[]> {
    return this.attempts.findAllByPerson(query.personId);
  }

  async getVerificationAttemptById(query: GetVerificationAttemptByIdQuery): Promise<VerificationAttempt | null> {
    return this.attempts.findById(query.attemptId);
  }

  async getBiometricProfileById(query: GetBiometricProfileByIdQuery): Promise<BiometricProfile | null> {
    return this.profiles.findById(query.profileId);
  }
}
