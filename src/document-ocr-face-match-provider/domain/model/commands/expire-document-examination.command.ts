import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

export class ExpireDocumentExaminationCommand {
  constructor(
    public readonly examinationId: ExaminationId,
    public readonly now: Date,
  ) {
    if (!examinationId) throw new Error('examination required');
  }
}
