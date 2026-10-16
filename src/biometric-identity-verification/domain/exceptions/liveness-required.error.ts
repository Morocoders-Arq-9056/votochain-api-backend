export class LivenessRequiredError extends Error {
  constructor(message = 'LivenessRequired') {
    super(message);
    Object.setPrototypeOf(this, LivenessRequiredError.prototype);
  }
}
