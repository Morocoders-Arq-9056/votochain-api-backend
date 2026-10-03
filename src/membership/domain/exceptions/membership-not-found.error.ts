export class MembershipNotFoundError extends Error {
  constructor(message = 'membership not found') {
    super(message);
    Object.setPrototypeOf(this, MembershipNotFoundError.prototype);
  }
}
