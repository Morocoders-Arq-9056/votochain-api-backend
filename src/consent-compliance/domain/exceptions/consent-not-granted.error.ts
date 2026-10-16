export class ConsentNotGrantedError extends Error {
  constructor(message = 'only a granted consent can be revoked') {
    super(message);
    Object.setPrototypeOf(this, ConsentNotGrantedError.prototype);
    this.name = 'ConsentNotGrantedError';
  }
}

