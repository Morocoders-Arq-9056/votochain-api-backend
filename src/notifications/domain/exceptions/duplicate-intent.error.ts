/**
 * Rejection raised when an idempotency key was already seen: the repeated
 * intent is persisted as REFUSED history (DUPLICATE) and never delivered twice.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DuplicateIntentError extends Error {
  constructor(message = 'idempotency key already seen') {
    super(message);
    Object.setPrototypeOf(this, DuplicateIntentError.prototype);
  }
}
