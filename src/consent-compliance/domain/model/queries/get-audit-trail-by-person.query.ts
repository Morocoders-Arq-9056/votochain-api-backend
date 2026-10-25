import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";

export class GetAuditTrailByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('person required');
  }
}
