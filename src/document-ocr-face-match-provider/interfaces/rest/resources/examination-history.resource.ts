import { ExaminationResource } from './examination.resource.js';

/** Examination history envelope. */
export class ExaminationHistoryResource {
  constructor(public readonly items: ExaminationResource[]) {}
}
