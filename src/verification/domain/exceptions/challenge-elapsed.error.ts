/**
 * Raised when a code is presented against a challenge whose validity window
 * has elapsed. Distinct from `AlreadyAnsweredError` because the judged fact
 * is EXPIRED (terminal, 410 Gone), not a consumed/invalidated challenge (409).
 */
export class ChallengeElapsedError extends Error {
  constructor(message = 'validity window elapsed') {
    super(message);
    Object.setPrototypeOf(this, ChallengeElapsedError.prototype);
  }
}
