export class PersonUnknownError extends Error {
  constructor(message = 'person unknown') {
    super(message);
    Object.setPrototypeOf(this, PersonUnknownError.prototype);
  }
}
