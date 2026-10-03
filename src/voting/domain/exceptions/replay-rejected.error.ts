export class ReplayRejectedError extends Error {
  constructor(message = 'ReplayRejected') {
    super(message);
    Object.setPrototypeOf(this, ReplayRejectedError.prototype);
  }
}
