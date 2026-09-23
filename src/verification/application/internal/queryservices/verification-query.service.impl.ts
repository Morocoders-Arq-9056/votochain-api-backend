import { Inject, Injectable } from '@nestjs/common';
import { VERIFICATION_CHALLENGE_REPOSITORY } from '../../../domain/repositories/verification-challenge.repository.js';
import type { VerificationChallengeRepository } from '../../../domain/repositories/verification-challenge.repository.js';
import { VerificationQueryService } from '../../../domain/services/verification-query.service.js';
import { GetChallengeHistoryByPersonAndPurposeQuery } from '../../../domain/model/queries/get-challenge-history-by-person-and-purpose.query.js';
import { GetChallengeStandingByPersonAndPurposeQuery } from '../../../domain/model/queries/get-challenge-standing-by-person-and-purpose.query.js';
import { VerificationChallenge } from '../../../domain/model/aggregates/verification-challenge.aggregate.js';

/**
 * Read-only query service for challenge standing and scrutiny history.
 * No unit of work, no mutations, no events: pure orchestration over the
 * repository port plus the aggregate's answering operation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class VerificationQueryServiceImpl implements VerificationQueryService {
  /**
   * Wires the query service over the repository port.
   * @param challenges Repository port for the VerificationChallenge aggregate.
   */
  constructor(
    @Inject(VERIFICATION_CHALLENGE_REPOSITORY) private readonly challenges: VerificationChallengeRepository,
  ) {}

  /**
   * Answers usability and remaining attempts; null-object when nothing is OPEN.
   * @inheritdoc
   */
  async getChallengeStandingByPersonAndPurpose(
    query: GetChallengeStandingByPersonAndPurposeQuery,
  ): Promise<{ usable: boolean; remaining: number }> {
    const open = await this.challenges.findOpenByPersonAndPurpose(query.personId, query.purpose);
    return open ? open.answerChallengeStanding(new Date()) : { usable: false, remaining: 0 };
  }

  /**
   * Returns every persisted challenge for the pair, ordered by request time.
   * @inheritdoc
   */
  async getChallengeHistoryByPersonAndPurpose(
    query: GetChallengeHistoryByPersonAndPurposeQuery,
  ): Promise<VerificationChallenge[]> {
    return this.challenges.findAllByPersonAndPurpose(query.personId, query.purpose);
  }
}
