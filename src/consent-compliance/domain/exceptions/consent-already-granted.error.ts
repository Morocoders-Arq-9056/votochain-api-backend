export class ConsentAlreadyGrantedError extends Error {
  constructor(message = 'live GRANTED record already covers (person, scope)') {
    super(message);
    Object.setPrototypeOf(this, ConsentAlreadyGrantedError.prototype);
    this.name = 'ConsentAlreadyGrantedError';
  }
}

