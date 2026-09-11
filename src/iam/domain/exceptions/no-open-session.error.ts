export class NoOpenSessionError extends Error {
  constructor(message = 'no open session') {
    super(message);
    Object.setPrototypeOf(this, NoOpenSessionError.prototype);
  }
}
