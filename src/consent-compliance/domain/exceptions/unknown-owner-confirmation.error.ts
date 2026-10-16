export class UnknownOwnerConfirmationError extends Error {
  constructor(message = 'owner never coordinated') {
    super(message);
    Object.setPrototypeOf(this, UnknownOwnerConfirmationError.prototype);
    this.name = 'UnknownOwnerConfirmationError';
  }
}

