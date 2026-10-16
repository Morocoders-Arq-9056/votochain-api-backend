export class UnsignedContentRefusedError extends Error {
  constructor(message = 'content must arrive already signed') {
    super(message);
    Object.setPrototypeOf(this, UnsignedContentRefusedError.prototype);
    this.name = 'UnsignedContentRefusedError';
  }
}

