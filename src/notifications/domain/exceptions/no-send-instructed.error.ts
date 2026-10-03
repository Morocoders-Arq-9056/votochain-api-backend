/**
 * Rejection raised when a failure webhook lands on a dispatch with no send
 * instructed for the current attempt.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class NoSendInstructedError extends Error {
  constructor(message = 'no send instructed for the current attempt') {
    super(message);
    Object.setPrototypeOf(this, NoSendInstructedError.prototype);
  }
}
