export class LastAdminRefusedError extends Error {
  constructor(message = 'last admin refused') {
    super(message);
    Object.setPrototypeOf(this, LastAdminRefusedError.prototype);
  }
}
