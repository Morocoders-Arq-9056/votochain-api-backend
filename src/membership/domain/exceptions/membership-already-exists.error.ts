export class MembershipAlreadyExistsError extends Error {
  constructor(message = 'membership already exists') {
    super(message);
    Object.setPrototypeOf(this, MembershipAlreadyExistsError.prototype);
  }
}
