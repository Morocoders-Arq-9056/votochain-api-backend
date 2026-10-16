import { DocumentRef } from "../../../domain/model/valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../../../domain/model/valueobjects/examination-id.value-object.js";
import { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { NoOpenExaminationError } from "../../../domain/exceptions/no-open-examination.error.js";

/**
 * Parses examination boundary strings into domain value objects. Corrupt
 * input raises domain rejections so the exception filter maps them (404).
 */
export class ExaminationParamsAssembler {
  static toExaminationId(id: string): ExaminationId {
    try {
      return ExaminationId.of(id);
    } catch {
      throw new NoOpenExaminationError('examination not found');
    }
  }

  static toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new NoOpenExaminationError('examination not found');
    }
  }

  static toDocumentRef(documentRef: string): DocumentRef {
    try {
      return DocumentRef.of(documentRef);
    } catch {
      throw new NoOpenExaminationError('examination not found');
    }
  }
}
