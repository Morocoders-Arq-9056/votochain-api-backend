/**
 * Rejection raised when a delivery address has no email shape.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class AddressMalformedError extends Error {
  constructor(message = 'malformed delivery address') {
    super(message);
    Object.setPrototypeOf(this, AddressMalformedError.prototype);
  }
}
