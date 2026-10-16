export class ErasureNotConfirmedError extends Error {
  constructor(message = 'erasure request is not in the expected standing') {
    super(message);
    Object.setPrototypeOf(this, ErasureNotConfirmedError.prototype);
    this.name = 'ErasureNotConfirmedError';
  }
}

