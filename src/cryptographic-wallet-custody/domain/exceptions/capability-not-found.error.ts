export class CapabilityNotFoundError extends Error {
  constructor(message = 'CapabilityNotFound') {
    super(message);
    Object.setPrototypeOf(this, CapabilityNotFoundError.prototype);
  }
}
