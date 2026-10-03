export class TerminationIsTerminalError extends Error {
  constructor(message = 'termination is terminal') {
    super(message);
    Object.setPrototypeOf(this, TerminationIsTerminalError.prototype);
  }
}
