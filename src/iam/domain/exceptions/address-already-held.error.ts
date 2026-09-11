export class AddressAlreadyHeldError extends Error {
  constructor(message = 'address already held') {
    super(message);
    Object.setPrototypeOf(this, AddressAlreadyHeldError.prototype);
  }
}
