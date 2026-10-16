import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { DataCategory } from "../valueobjects/data-category.value-object.js";

export class GetConsentStateByPersonAndScopeQuery {
  constructor(public readonly personId: PersonId, public readonly scope: ConsentScope) {
    if (!personId || !scope) throw new Error('person+scope required');
  }
}

export class GetErasureStandingByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('person required');
  }
}

export class GetRetentionTermsByCategoryQuery {
  constructor(public readonly category: DataCategory) {
    if (!category) throw new Error('category required');
  }
}

export class GetAuditTrailByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('person required');
  }
}
