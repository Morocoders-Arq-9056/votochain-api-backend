export class ReferenceAlreadyExistsError extends Error {
  constructor(message = 'ReferenceAlreadyExists') {
    super(message);
    Object.setPrototypeOf(this, ReferenceAlreadyExistsError.prototype);
  }
}
