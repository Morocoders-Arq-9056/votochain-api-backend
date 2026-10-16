import { DocumentExamination } from "../model/aggregates/document-examination.aggregate.js";
import { DocumentRef } from "../model/valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../model/valueobjects/examination-id.value-object.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";

/**
 * Persistence port for the DocumentExamination aggregate root.
 *
 * At most one OPEN examination per (person, document), enforced by the
 * `uq_open_exam` partial unique index plus the application-level finder.
 */
export interface ExaminationRepository {
  findById(id: ExaminationId): Promise<DocumentExamination | null>;
  findOpenByPersonAndDocument(personId: PersonId, documentRef: DocumentRef): Promise<DocumentExamination | null>;
  findAllByPersonAndDocument(personId: PersonId, documentRef: DocumentRef): Promise<DocumentExamination[]>;
  findAllByPerson(personId: PersonId): Promise<DocumentExamination[]>;
  save(examination: DocumentExamination): Promise<void>;
}
export const EXAMINATION_REPOSITORY = Symbol('EXAMINATION_REPOSITORY');
