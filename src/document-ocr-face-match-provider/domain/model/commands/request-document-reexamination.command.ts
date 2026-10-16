import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

export class RequestDocumentReexaminationCommand {
  constructor(public readonly priorExaminationId: ExaminationId) {
    if (!priorExaminationId) throw new Error('prior examination required');
  }
}
