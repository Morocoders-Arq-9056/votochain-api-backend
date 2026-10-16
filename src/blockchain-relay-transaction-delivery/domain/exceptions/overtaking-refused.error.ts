export class OvertakingRefusedError extends Error {
  constructor(message = 'sending order overtaking refused') {
    super(message);
    Object.setPrototypeOf(this, OvertakingRefusedError.prototype);
    this.name = 'OvertakingRefusedError';
  }
}

