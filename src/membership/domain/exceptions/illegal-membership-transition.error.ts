export class IllegalMembershipTransitionError extends Error {
  constructor(message = 'illegal membership transition') {
    super(message);
    Object.setPrototypeOf(this, IllegalMembershipTransitionError.prototype);
  }
}
