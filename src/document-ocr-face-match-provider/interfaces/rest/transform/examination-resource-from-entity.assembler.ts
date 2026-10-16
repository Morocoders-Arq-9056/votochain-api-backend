import { DocumentExamination } from "../../../domain/model/aggregates/document-examination.aggregate.js";
import { ExaminationHistoryResource } from "../resources/examination-history.resource.js";
import { ExaminationResource } from "../resources/examination.resource.js";
import { ExaminationStandingResource } from "../resources/examination-standing.resource.js";

/** Renders response resources straight from re-read aggregates. */
export class ExaminationResourceFromEntityAssembler {
  static toResourceFromEntity(examination: DocumentExamination): ExaminationResource {
    return new ExaminationResource(
      examination.id.value,
      examination.personId.value,
      examination.documentRef.value,
      examination.standing,
      examination.verdict,
      examination.consumed,
    );
  }

  static toHistoryResource(examinations: DocumentExamination[]): ExaminationHistoryResource {
    return new ExaminationHistoryResource(examinations.map((e) => this.toResourceFromEntity(e)));
  }

  static toStandingResource(answer: { usableMatch: boolean }): ExaminationStandingResource {
    return new ExaminationStandingResource(answer.usableMatch);
  }
}
