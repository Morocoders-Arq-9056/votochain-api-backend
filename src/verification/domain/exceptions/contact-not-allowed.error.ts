export class ContactNotAllowedError extends Error {
  constructor(message = 'contact not allowed') {
    super(message);
    Object.setPrototypeOf(this, ContactNotAllowedError.prototype);
  }
}
