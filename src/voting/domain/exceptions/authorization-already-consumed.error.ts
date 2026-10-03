export class AuthorizationAlreadyConsumedError extends Error {
  constructor(message = 'AuthorizationAlreadyConsumed') {
    super(message);
    Object.setPrototypeOf(this, AuthorizationAlreadyConsumedError.prototype);
  }
}
