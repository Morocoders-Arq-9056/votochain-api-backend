export class AuthorizationNotFoundError extends Error {
  constructor(message = 'authorization not found') {
    super(message);
    Object.setPrototypeOf(this, AuthorizationNotFoundError.prototype);
  }
}
