export class RoleAlreadyHeldError extends Error {
  constructor(message = 'role already held') {
    super(message);
    Object.setPrototypeOf(this, RoleAlreadyHeldError.prototype);
  }
}
