export class ExaminationAlreadyOpenError extends Error {
  constructor(message = 'ExaminationAlreadyOpen') {
    super(message);
    Object.setPrototypeOf(this, ExaminationAlreadyOpenError.prototype);
  }
}
