import { Inject, Injectable } from "@nestjs/common";
import { GetAuditTrailByPersonQuery, GetConsentStateByPersonAndScopeQuery, GetErasureStandingByPersonQuery, GetRetentionTermsByCategoryQuery } from "../../../domain/model/queries/consent.queries.js";
import { CONSENT_REPOSITORY } from "../../../domain/repositories/consent.repository.js";
import type { ConsentRepository } from "../../../domain/repositories/consent.repository.js";
import { ERASURE_REPOSITORY } from "../../../domain/repositories/erasure.repository.js";
import type { ErasureRepository } from "../../../domain/repositories/erasure.repository.js";
import { RETENTION_REPOSITORY } from "../../../domain/repositories/retention.repository.js";
import type { RetentionRepository } from "../../../domain/repositories/retention.repository.js";
import type {
  AuditEntry,
  ConsentQueryService,
  ConsentStateAnswer,
  ErasureQueryService,
  ErasureStandingAnswer,
  RetentionTermsAnswer,
} from "../../../domain/services/consent.services.js";

@Injectable()
export class ConsentQueryServiceImpl implements ConsentQueryService {
  constructor(@Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository) {}

  async getConsentStateByPersonAndScope(q: GetConsentStateByPersonAndScopeQuery): Promise<ConsentStateAnswer> {
    const live = await this.consents.findLive(q.personId, q.scope);
    if (!live) return { granted: false, policyVersion: '', since: null };
    const state = live.answerState();
    return { granted: state.granted, policyVersion: state.policyVersion, since: state.since };
  }

  async getAuditTrailByPerson(q: GetAuditTrailByPersonQuery): Promise<AuditEntry[]> {
    const history = await this.consents.findHistory(q.personId);
    return history.map((r) => ({
      kind: r.standing === 'GRANTED' ? 'ConsentGranted' : 'ConsentRevoked',
      at: r.answerState().since.toISOString(),
      detail: { recordId: r.id.value, scope: r.scope.value, policyVersion: r.answerState().policyVersion },
    }));
  }
}

@Injectable()
export class ErasureQueryServiceImpl implements ErasureQueryService {
  constructor(
    @Inject(ERASURE_REPOSITORY) private readonly requests: ErasureRepository,
    @Inject(RETENTION_REPOSITORY) private readonly policies: RetentionRepository,
  ) {}

  async getErasureStandingByPerson(q: GetErasureStandingByPersonQuery): Promise<ErasureStandingAnswer | null> {
    const latest = await this.requests.findLatestByPerson(q.personId);
    if (!latest) return null;
    const answer = latest.answerStanding();
    return { standing: answer.standing, pending: answer.pending, confirmed: answer.confirmed };
  }

  async getRetentionTermsByCategory(q: GetRetentionTermsByCategoryQuery): Promise<RetentionTermsAnswer | null> {
    const latest = await this.policies.findLatestByCategory(q.category);
    if (!latest) return null;
    const terms = latest.answerTerms();
    return { category: terms.category, terms: terms.terms.value };
  }
}
