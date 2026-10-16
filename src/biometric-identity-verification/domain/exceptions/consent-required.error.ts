export class ConsentRequiredError extends Error {
  constructor(message = 'ConsentRequired') {
    super(message);
    Object.setPrototypeOf(this, ConsentRequiredError.prototype);
  }
}
