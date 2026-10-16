export class IllegalDeliveryStateError extends Error {
  constructor(message = 'illegal delivery state') {
    super(message);
    Object.setPrototypeOf(this, IllegalDeliveryStateError.prototype);
    this.name = 'IllegalDeliveryStateError';
  }
}

