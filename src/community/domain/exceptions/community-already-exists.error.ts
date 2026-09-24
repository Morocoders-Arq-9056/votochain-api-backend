export class CommunityAlreadyExistsError extends Error {
  constructor(message = 'community already exists') {
    super(message);
    Object.setPrototypeOf(this, CommunityAlreadyExistsError.prototype);
  }
}
