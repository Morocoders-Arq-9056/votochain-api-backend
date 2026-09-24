export class AdminAlreadyAppointedError extends Error {
  constructor(message = 'admin already appointed') {
    super(message);
    Object.setPrototypeOf(this, AdminAlreadyAppointedError.prototype);
  }
}
