import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

export class GetExaminationByIdQuery {
  constructor(public readonly examinationId: ExaminationId) {}
}
