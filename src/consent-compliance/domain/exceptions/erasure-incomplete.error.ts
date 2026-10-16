export class ErasureIncompleteError extends Error {
  constructor(message = 'every coordinated owner must confirm first') {
    super(message);
    Object.setPrototypeOf(this, ErasureIncompleteError.prototype);
    this.name = 'ErasureIncompleteError';
  }
}

