/**
 * Rejection raised when a membership references a person unknown to IAM.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class PersonUnknownError extends Error {
  constructor(message = 'person unknown') {
    super(message);
    Object.setPrototypeOf(this, PersonUnknownError.prototype);
  }
}
