export class LastAdministratorError extends Error {
  constructor(message = 'last administrator refused') {
    super(message);
    Object.setPrototypeOf(this, LastAdministratorError.prototype);
  }
}
