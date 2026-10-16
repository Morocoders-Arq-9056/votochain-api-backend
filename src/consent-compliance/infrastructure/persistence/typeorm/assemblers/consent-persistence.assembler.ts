import { Injectable } from "@nestjs/common";
import { PersonId } from "../../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ConsentRecord } from "../../../../domain/model/aggregates/consent-record.aggregate.js";
import { DataSubjectRequest } from "../../../../domain/model/aggregates/data-subject-request.aggregate.js";
import { RetentionPolicy } from "../../../../domain/model/aggregates/retention-policy.aggregate.js";
import { ConsentRecordId } from "../../../../domain/model/valueobjects/consent-record-id.value-object.js";
import { ConsentScope } from "../../../../domain/model/valueobjects/consent-scope.value-object.js";
import { parseConsentStanding, parseErasureStanding } from "../../../../domain/model/valueobjects/consent-standings.value-object.js";
import { DataCategory } from "../../../../domain/model/valueobjects/data-category.value-object.js";
import { DataSubjectRequestId } from "../../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { PolicyVersion } from "../../../../domain/model/valueobjects/policy-version.value-object.js";
import { RetentionPolicyId } from "../../../../domain/model/valueobjects/retention-policy-id.value-object.js";
import { RetentionTerms } from "../../../../domain/model/valueobjects/retention-terms.value-object.js";
import { RevocationConfirmations } from "../../../../domain/model/valueobjects/revocation-confirmations.value-object.js";
import { ConsentOrmEntity, ErasureRequestOrmEntity, RetentionPolicyOrmEntity } from "../entities/consent.orm-entities.js";

/**
 * Translates between consent aggregates and rows. Closed sets go through
 * `parse*Standing()` + `ConsentScope.of()` — never `as`-casts.
 */
@Injectable()
export class ConsentPersistenceAssembler {
  toConsentDomain(orm: ConsentOrmEntity): ConsentRecord {
    return ConsentRecord.rehydrate({
      id: ConsentRecordId.of(orm.id),
      personId: PersonId.of(orm.personId),
      scope: ConsentScope.of(orm.scope),
      standing: parseConsentStanding(orm.standing),
      policyVersion: PolicyVersion.of(orm.policyVersion),
      grantedAt: orm.grantedAt,
    });
  }

  toConsentOrm(domain: ConsentRecord): ConsentOrmEntity {
    const orm = new ConsentOrmEntity();
    orm.id = domain.id.value;
    orm.personId = domain.personId.value;
    orm.scope = domain.scope.value;
    orm.standing = domain.standing;
    orm.policyVersion = domain.answerState().policyVersion;
    orm.grantedAt = domain.answerState().since;
    return orm;
  }
}

@Injectable()
export class ErasurePersistenceAssembler {
  toDomain(orm: ErasureRequestOrmEntity): DataSubjectRequest {
    return DataSubjectRequest.rehydrate({
      id: DataSubjectRequestId.of(orm.id),
      personId: PersonId.of(orm.personId),
      standing: parseErasureStanding(orm.standing),
      confirmations: RevocationConfirmations.fromJSON(orm.confirmations),
    });
  }

  toOrm(domain: DataSubjectRequest): ErasureRequestOrmEntity {
    const orm = new ErasureRequestOrmEntity();
    orm.id = domain.id.value;
    orm.personId = domain.personId.value;
    orm.standing = domain.standing;
    orm.confirmations = domain.confirmations.toJSON();
    return orm;
  }
}

@Injectable()
export class RetentionPersistenceAssembler {
  toDomain(orm: RetentionPolicyOrmEntity): RetentionPolicy {
    return RetentionPolicy.rehydrate({
      id: RetentionPolicyId.of(orm.id),
      category: DataCategory.of(orm.category),
      terms: RetentionTerms.of(orm.terms ?? {}),
      supersedes: orm.supersedes,
    });
  }

  toOrm(domain: RetentionPolicy): RetentionPolicyOrmEntity {
    const orm = new RetentionPolicyOrmEntity();
    orm.id = domain.id.value;
    orm.category = domain.category.value;
    orm.terms = domain.answerTerms().terms.value;
    orm.supersedes = domain.supersedes;
    return orm;
  }
}
