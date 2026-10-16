export class OrderConcludedError extends Error {
  constructor(message = 'delivery order already concluded') {
    super(message);
    Object.setPrototypeOf(this, OrderConcludedError.prototype);
    this.name = 'OrderConcludedError';
  }
}

