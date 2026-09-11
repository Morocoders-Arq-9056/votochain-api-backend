export class RoleNotHeldError extends Error {
  constructor(message = 'role not held') {
    super(message);
    Object.setPrototypeOf(this, RoleNotHeldError.prototype);
  }
}
