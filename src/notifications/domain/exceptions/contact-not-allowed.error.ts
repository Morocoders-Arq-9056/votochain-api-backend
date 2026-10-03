/**
 * Rejection raised when the consent gate refuses contact now: the intent is
 * persisted as REFUSED history (CONTACT_NOT_ALLOWED), never silently dropped.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class ContactNotAllowedError extends Error {
  constructor(message = 'contact not allowed now') {
    super(message);
    Object.setPrototypeOf(this, ContactNotAllowedError.prototype);
  }
}
