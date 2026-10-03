/**
 * Rejection raised when no dispatch answers an id: unknown dispatches or keys
 * answer 404 instead of falling through to the global filter as 500.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DispatchNotFoundError extends Error {
  constructor(message = 'dispatch not found') {
    super(message);
    Object.setPrototypeOf(this, DispatchNotFoundError.prototype);
  }
}
