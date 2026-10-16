import { DocumentExamination } from "../model/aggregates/document-examination.aggregate.js";
import { GetExaminationByIdQuery } from "../model/queries/get-examination-by-id.query.js";
import { GetExaminationStandingByPersonAndDocumentQuery } from "../model/queries/get-examination-standing-by-person-and-document.query.js";
import { GetExaminationHistoryByPersonAndDocumentQuery } from "../model/queries/get-examination-history-by-person-and-document.query.js";

/**
 * Domain port for examination reads. Read-only: judges current state and
 * answers, mutates nothing, produces no facts.
 */
export interface ExaminationQueryService {
  getExaminationById(query: GetExaminationByIdQuery): Promise<DocumentExamination | null>;
  getExaminationStandingByPersonAndDocument(
    query: GetExaminationStandingByPersonAndDocumentQuery,
  ): Promise<{ usableMatch: boolean }>;
  getExaminationHistoryByPersonAndDocument(
    query: GetExaminationHistoryByPersonAndDocumentQuery,
  ): Promise<DocumentExamination[]>;
}
export const EXAMINATION_QUERY_SERVICE = Symbol('EXAMINATION_QUERY_SERVICE');
