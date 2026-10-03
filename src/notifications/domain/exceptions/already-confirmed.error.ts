/**
 * Rejection raised when a confirm webhook lands on a dispatch that already
 * left REQUESTED: only a requested dispatch can be confirmed.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AlreadyConfirmedError extends Error {
  constructor(message = 'only a requested dispatch can be confirmed') {
    super(message);
    Object.setPrototypeOf(this, AlreadyConfirmedError.prototype);
  }
}
