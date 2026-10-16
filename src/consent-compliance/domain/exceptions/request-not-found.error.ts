export class RequestNotFoundError extends Error {
  constructor(message = 'erasure request not found') {
    super(message);
    Object.setPrototypeOf(this, RequestNotFoundError.prototype);
    this.name = 'RequestNotFoundError';
  }
}

