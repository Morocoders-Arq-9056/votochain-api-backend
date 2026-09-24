export class CommunityNotActiveError extends Error {
  constructor(message = 'community not active') {
    super(message);
    Object.setPrototypeOf(this, CommunityNotActiveError.prototype);
  }
}
