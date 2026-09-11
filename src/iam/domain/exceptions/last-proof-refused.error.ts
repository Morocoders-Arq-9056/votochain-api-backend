export class LastProofRefusedError extends Error {
  constructor(message = 'last proof refused') {
    super(message);
    Object.setPrototypeOf(this, LastProofRefusedError.prototype);
  }
}
