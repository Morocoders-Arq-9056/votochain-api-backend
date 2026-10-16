export class AttemptConcludedError extends Error {
  constructor(message = 'AttemptConcluded') {
    super(message);
    Object.setPrototypeOf(this, AttemptConcludedError.prototype);
  }
}
