export class NoEligibleMembershipError extends Error {
  constructor(message = 'NoEligibleMembership') {
    super(message);
    Object.setPrototypeOf(this, NoEligibleMembershipError.prototype);
  }
}
