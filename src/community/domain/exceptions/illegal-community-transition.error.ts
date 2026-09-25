export class IllegalCommunityTransitionError extends Error {
  constructor(message = 'illegal community transition') {
    super(message);
    Object.setPrototypeOf(this, IllegalCommunityTransitionError.prototype);
  }
}
