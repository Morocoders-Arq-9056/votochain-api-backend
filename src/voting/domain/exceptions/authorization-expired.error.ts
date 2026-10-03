export class AuthorizationExpiredError extends Error {
  constructor(message = 'AuthorizationExpired') {
    super(message);
    Object.setPrototypeOf(this, AuthorizationExpiredError.prototype);
  }
}
