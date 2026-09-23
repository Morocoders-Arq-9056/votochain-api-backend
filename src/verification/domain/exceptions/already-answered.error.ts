export class AlreadyAnsweredError extends Error {
  constructor(message = 'challenge already answered') {
    super(message);
    Object.setPrototypeOf(this, AlreadyAnsweredError.prototype);
  }
}
