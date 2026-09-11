export class IllegalUserStateError extends Error {
  constructor(message = 'illegal user state') {
    super(message);
    Object.setPrototypeOf(this, IllegalUserStateError.prototype);
  }
}