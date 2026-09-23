export class NoUsableChallengeError extends Error {
  constructor(message = 'no usable challenge') {
    super(message);
    Object.setPrototypeOf(this, NoUsableChallengeError.prototype);
  }
}
