export class ContactNotAllowedError extends Error {
  constructor(message = 'ContactNotAllowed') {
    super(message);
    Object.setPrototypeOf(this, ContactNotAllowedError.prototype);
  }
}
