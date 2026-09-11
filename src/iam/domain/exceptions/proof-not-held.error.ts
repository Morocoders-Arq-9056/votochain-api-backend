export class ProofNotHeldError extends Error {
  constructor(message = 'proof not held') {
    super(message);
    Object.setPrototypeOf(this, ProofNotHeldError.prototype);
  }
}
