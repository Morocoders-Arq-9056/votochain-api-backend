import { Inject, Injectable } from "@nestjs/common";
import { BIOMETRIC_QUERY_SERVICE } from "../../domain/services/biometric-query.service.js";
import type { BiometricQueryService } from "../../domain/services/biometric-query.service.js";
import { GetVerificationStandingByPersonQuery } from "../../domain/model/queries/get-verification-standing-by-person.query.js";
import { PersonId } from "../../domain/model/valueobjects/person-id.value-object.js";
import type { BiometricContextFacade } from "../../interfaces/acl/biometric-context.facade.js";

/**
 * Application implementation of the published {@link BiometricContextFacade}.
 * Translates boundary primitives into domain VOs, delegates to the query
 * service, and translates back to primitives.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class BiometricContextFacadeImpl implements BiometricContextFacade {
  constructor(@Inject(BIOMETRIC_QUERY_SERVICE) private readonly queries: BiometricQueryService) {}

  async answerVerifiedNow(
    personId: string,
    nowIso: string,
  ): Promise<{ verifiedNow: boolean; reason: string | null }> {
    try {
      const person = PersonId.of(personId);
      const now = new Date(nowIso);
      if (Number.isNaN(now.getTime())) throw new Error('invalid now');
      return await this.queries.getVerificationStandingByPerson(
        new GetVerificationStandingByPersonQuery(person, now),
      );
    } catch {
      return { verifiedNow: false, reason: 'UNKNOWN_PERSON' };
    }
  }
}
