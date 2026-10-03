export class VoteNotFoundError extends Error {
  constructor(message = 'vote not found') {
    super(message);
    Object.setPrototypeOf(this, VoteNotFoundError.prototype);
  }
}
