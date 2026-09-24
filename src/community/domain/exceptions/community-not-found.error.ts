export class CommunityNotFoundError extends Error {
  constructor(message = 'community not found') {
    super(message);
    Object.setPrototypeOf(this, CommunityNotFoundError.prototype);
  }
}
