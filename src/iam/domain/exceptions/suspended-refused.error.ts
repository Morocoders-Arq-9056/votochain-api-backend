export class SuspendedRefusedError extends Error {
  constructor(message = 'access suspended') {
    super(message);
    Object.setPrototypeOf(this, SuspendedRefusedError.prototype);
  }
}
