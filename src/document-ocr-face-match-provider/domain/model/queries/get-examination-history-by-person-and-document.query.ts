import { DocumentRef } from "../valueobjects/document-ref.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetExaminationHistoryByPersonAndDocumentQuery {
  constructor(
    public readonly personId: PersonId,
    public readonly documentRef: DocumentRef,
  ) {}
}
