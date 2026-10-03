/**
 * Rejection raised when a template key names no catalog entry.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class TemplateUnknownError extends Error {
  constructor(message = 'unknown template') {
    super(message);
    Object.setPrototypeOf(this, TemplateUnknownError.prototype);
  }
}
