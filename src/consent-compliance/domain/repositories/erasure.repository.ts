import type { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { DataSubjectRequest } from "../model/aggregates/data-subject-request.aggregate.js";
import type { DataSubjectRequestId } from "../model/valueobjects/data-subject-request-id.value-object.js";

export const ERASURE_REPOSITORY = Symbol('ERASURE_REPOSITORY');

export interface ErasureRepository {
  findById(id: DataSubjectRequestId): Promise<DataSubjectRequest | null>;
  findOpenByPerson(personId: PersonId): Promise<DataSubjectRequest | null>;
  findLatestByPerson(personId: PersonId): Promise<DataSubjectRequest | null>;
  save(request: DataSubjectRequest): Promise<void>;
}
