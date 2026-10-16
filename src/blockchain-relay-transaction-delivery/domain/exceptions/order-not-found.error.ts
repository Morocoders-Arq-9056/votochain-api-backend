export class OrderNotFoundError extends Error {
  constructor(message = 'delivery order not found') {
    super(message);
    Object.setPrototypeOf(this, OrderNotFoundError.prototype);
    this.name = 'OrderNotFoundError';
  }
}

