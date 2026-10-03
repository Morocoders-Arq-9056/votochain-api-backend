export class DuplicatePendingAuthorizationError extends Error {
  constructor(message = 'duplicate pending authorization') {
    super(message);
    Object.setPrototypeOf(this, DuplicatePendingAuthorizationError.prototype);
  }
}
