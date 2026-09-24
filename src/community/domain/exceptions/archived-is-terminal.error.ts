export class ArchivedIsTerminalError extends Error {
  constructor(message = 'archived is terminal') {
    super(message);
    Object.setPrototypeOf(this, ArchivedIsTerminalError.prototype);
  }
}
