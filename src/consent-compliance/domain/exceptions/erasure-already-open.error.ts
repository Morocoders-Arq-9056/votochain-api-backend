export class ErasureAlreadyOpenError extends Error {
  constructor(message = 'an open erasure request already exists for this person') {
    super(message);
    Object.setPrototypeOf(this, ErasureAlreadyOpenError.prototype);
    this.name = 'ErasureAlreadyOpenError';
  }
}

