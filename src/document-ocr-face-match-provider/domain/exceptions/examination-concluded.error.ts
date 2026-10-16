export class ExaminationConcludedError extends Error {
  constructor(message = 'ExaminationConcluded') {
    super(message);
    Object.setPrototypeOf(this, ExaminationConcludedError.prototype);
  }
}
