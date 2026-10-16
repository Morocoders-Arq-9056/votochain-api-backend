export class NoOpenExaminationError extends Error {
  constructor(message = 'NoOpenExamination') {
    super(message);
    Object.setPrototypeOf(this, NoOpenExaminationError.prototype);
  }
}
