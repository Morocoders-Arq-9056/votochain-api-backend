/**
 * Rejection raised when a retry targets a dispatch that is not FAILED:
 * CONFIRMED/REFUSED never retry, and REQUESTED is already in flight.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RetryNotAllowedError extends Error {
  constructor(message = 'only a failed dispatch can retry') {
    super(message);
    Object.setPrototypeOf(this, RetryNotAllowedError.prototype);
  }
}
