export class PolicyUndefinedError extends Error {
  constructor(message = 'voting policy undefined') {
    super(message);
    Object.setPrototypeOf(this, PolicyUndefinedError.prototype);
  }
}
