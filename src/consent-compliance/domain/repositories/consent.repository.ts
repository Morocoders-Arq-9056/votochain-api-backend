import type { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentRecord } from "../model/aggregates/consent-record.aggregate.js";
import type { ConsentScope } from "../model/valueobjects/consent-scope.value-object.js";

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

export interface ConsentRepository {
  findLive(personId: PersonId, scope: ConsentScope): Promise<ConsentRecord | null>;
  findHistory(personId: PersonId): Promise<ConsentRecord[]>;
  save(record: ConsentRecord): Promise<void>;
}
