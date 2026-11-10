export class InvalidCredentialsError extends Error {
  constructor(message = 'invalid credentials') {
    super(message);
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}
