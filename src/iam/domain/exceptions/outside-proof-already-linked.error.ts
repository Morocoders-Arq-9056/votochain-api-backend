export class OutsideProofAlreadyLinkedError extends Error {
  constructor(message = 'outside proof already linked') {
    super(message);
    Object.setPrototypeOf(this, OutsideProofAlreadyLinkedError.prototype);
  }
}
