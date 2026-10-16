import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

/**
 * UC2 anchor: the worker triggers the examination of an already-requested
 * id. It names the pending work, not a human intent.
 */
export class ExamineDocumentExaminationCommand {
  constructor(public readonly examinationId: ExaminationId) {
    if (!examinationId) throw new Error('examination required');
  }
}
