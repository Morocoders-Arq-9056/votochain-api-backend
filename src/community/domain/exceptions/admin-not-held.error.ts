export class AdminNotHeldError extends Error {
  constructor(message = 'admin not held') {
    super(message);
    Object.setPrototypeOf(this, AdminNotHeldError.prototype);
  }
}
