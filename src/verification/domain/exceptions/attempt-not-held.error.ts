export class AttemptNotHeldError extends Error {
  constructor(message = 'attempt not held') {
    super(message);
    Object.setPrototypeOf(this, AttemptNotHeldError.prototype);
  }
}
