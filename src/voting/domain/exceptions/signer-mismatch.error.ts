export class SignerMismatchError extends Error {
  constructor(message = 'SignerMismatch') {
    super(message);
    Object.setPrototypeOf(this, SignerMismatchError.prototype);
  }
}
