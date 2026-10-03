export class InvalidChoiceError extends Error {
  constructor(message = 'InvalidChoice') {
    super(message);
    Object.setPrototypeOf(this, InvalidChoiceError.prototype);
  }
}
