export class RoleRequiresActiveError extends Error {
  constructor(message = 'role requires active') {
    super(message);
    Object.setPrototypeOf(this, RoleRequiresActiveError.prototype);
  }
}
