export class UserNotFoundError extends Error {
  constructor(message = 'user not found') {
    super(message);
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}
