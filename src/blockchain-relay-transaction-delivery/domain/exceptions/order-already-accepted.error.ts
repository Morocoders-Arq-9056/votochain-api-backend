export class OrderAlreadyAcceptedError extends Error {
  constructor(message = 'delivery order already accepted') {
    super(message);
    Object.setPrototypeOf(this, OrderAlreadyAcceptedError.prototype);
    this.name = 'OrderAlreadyAcceptedError';
  }
}

