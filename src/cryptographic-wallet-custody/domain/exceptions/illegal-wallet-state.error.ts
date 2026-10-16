export class IllegalWalletStateError extends Error {
  constructor(message = 'IllegalWalletState') {
    super(message);
    Object.setPrototypeOf(this, IllegalWalletStateError.prototype);
  }
}
