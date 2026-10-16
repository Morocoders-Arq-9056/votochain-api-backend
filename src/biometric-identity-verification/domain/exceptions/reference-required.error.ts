export class ReferenceRequiredError extends Error {
  constructor(message = 'ReferenceRequired') {
    super(message);
    Object.setPrototypeOf(this, ReferenceRequiredError.prototype);
  }
}
