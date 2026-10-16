import { Inject, Injectable } from "@nestjs/common";
import { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { GetConsentStateByPersonAndScopeQuery, GetErasureStandingByPersonQuery } from "../../domain/model/queries/consent.queries.js";
import { ConsentScope } from "../../domain/model/valueobjects/consent-scope.value-object.js";
import { CONSENT_REPOSITORY } from "../../domain/repositories/consent.repository.js";
import type { ConsentRepository } from "../../domain/repositories/consent.repository.js";
import { CONSENT_QUERY_SERVICE, ERASURE_QUERY_SERVICE } from "../../domain/services/consent.services.js";
import type { ConsentQueryService, ErasureQueryService } from "../../domain/services/consent.services.js";
import type { ConsentContextFacade } from "../../interfaces/acl/consent-context.facade.js";

/**
 * Application implementation of the published `CONSENT_CONTEXT_FACADE`.
 * Translates primitive boundary strings into domain VOs.
 *
 * Gate semantics (Law 29733, MVP):
 * - `mayProcessNow` is strict opt-in: only a live GRANTED record allows
 *   biometric/document processing.
 * - `mayContactNow` is opt-out: delivery is allowed unless the latest record
 *   for the key is an explicit REVOKED refusal. Absence of any record allows
 *   (signup/welcome/OTP flows predate consent rows); an explicit revocation
 *   refuses from that moment and the refusal persists as REFUSED history in
 *   Notifications â€” never a silent drop.
 */
@Injectable()
export class ConsentContextFacadeImpl implements ConsentContextFacade {
  constructor(
    @Inject(CONSENT_QUERY_SERVICE) private readonly consentQueries: ConsentQueryService,
    @Inject(ERASURE_QUERY_SERVICE) private readonly erasureQueries: ErasureQueryService,
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
  ) {}

  async mayProcessNow(personId: string, scope: string): Promise<{ granted: boolean; policyVersion: string }> {
    try {
      const answer = await this.consentQueries.getConsentStateByPersonAndScope(
        new GetConsentStateByPersonAndScopeQuery(PersonId.of(personId), ConsentScope.of(scope)));
      return { granted: answer.granted, policyVersion: answer.policyVersion };
    } catch {
      return { granted: false, policyVersion: '' };
    }
  }

  async mayContactNow(personId: string): Promise<boolean> {
    try {
      const person = PersonId.of(personId);
      const history = await this.consents.findHistory(person);
      const scoped = history.filter((r) => r.scope.value === 'EMAIL_NOTIFICATIONS');
      if (scoped.length === 0) return true;
      const latest = scoped[scoped.length - 1]!;
      return latest.standing === 'GRANTED';
    } catch {
      return true;
    }
  }

  async getErasureStanding(personId: string): Promise<{ standing: string; pending: string[] }> {
    const answer = await this.erasureQueries.getErasureStandingByPerson(
      new GetErasureStandingByPersonQuery(PersonId.of(personId)));
    if (!answer) return { standing: 'NONE', pending: [] };
    return { standing: answer.standing, pending: answer.pending };
  }
}
