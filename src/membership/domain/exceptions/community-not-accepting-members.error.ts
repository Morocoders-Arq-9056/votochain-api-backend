export class CommunityNotAcceptingMembersError extends Error {
  constructor(message = 'community not accepting members') {
    super(message);
    Object.setPrototypeOf(this, CommunityNotAcceptingMembersError.prototype);
  }
}
