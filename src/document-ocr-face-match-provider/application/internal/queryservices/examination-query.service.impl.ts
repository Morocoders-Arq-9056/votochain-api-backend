import { Inject, Injectable } from "@nestjs/common";
import { DocumentExamination } from "../../../domain/model/aggregates/document-examination.aggregate.js";
import { GetExaminationByIdQuery } from "../../../domain/model/queries/get-examination-by-id.query.js";
import { GetExaminationHistoryByPersonAndDocumentQuery } from "../../../domain/model/queries/get-examination-history-by-person-and-document.query.js";
import { GetExaminationStandingByPersonAndDocumentQuery } from "../../../domain/model/queries/get-examination-standing-by-person-and-document.query.js";
import { EXAMINATION_REPOSITORY } from "../../../domain/repositories/examination.repository.js";
import type { ExaminationRepository } from "../../../domain/repositories/examination.repository.js";
import type { ExaminationQueryService } from "../../../domain/services/examination-query.service.js";

/**
 * Read-only query service. Judges current state and answers; no unit of
 * work, no mutations, no events.
 */
@Injectable()
export class ExaminationQueryServiceImpl implements ExaminationQueryService {
  constructor(@Inject(EXAMINATION_REPOSITORY) private readonly exams: ExaminationRepository) {}

  async getExaminationById(query: GetExaminationByIdQuery): Promise<DocumentExamination | null> {
    return this.exams.findById(query.examinationId);
  }

  async getExaminationStandingByPersonAndDocument(
    query: GetExaminationStandingByPersonAndDocumentQuery,
  ): Promise<{ usableMatch: boolean }> {
    const open = await this.exams.findOpenByPersonAndDocument(query.personId, query.documentRef);
    if (open) return open.answerStanding();
    const latest = (await this.exams.findAllByPersonAndDocument(query.personId, query.documentRef))[0];
    return latest ? latest.answerStanding() : { usableMatch: false };
  }

  async getExaminationHistoryByPersonAndDocument(
    query: GetExaminationHistoryByPersonAndDocumentQuery,
  ): Promise<DocumentExamination[]> {
    return this.exams.findAllByPersonAndDocument(query.personId, query.documentRef);
  }
}
