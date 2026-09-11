export class AlreadyRegisteredError extends Error {
  constructor(message = 'already registered') {
    super(message);
    Object.setPrototypeOf(this, AlreadyRegisteredError.prototype);
  }
}
