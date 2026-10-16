export class ReferenceEndedError extends Error {
  constructor(message = 'ReferenceEnded') {
    super(message);
    Object.setPrototypeOf(this, ReferenceEndedError.prototype);
  }
}
