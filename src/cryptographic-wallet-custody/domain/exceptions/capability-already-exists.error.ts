export class CapabilityAlreadyExistsError extends Error {
  constructor(message = 'CapabilityAlreadyExists') {
    super(message);
    Object.setPrototypeOf(this, CapabilityAlreadyExistsError.prototype);
  }
}
