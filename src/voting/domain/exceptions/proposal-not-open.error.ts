export class ProposalNotOpenError extends Error {
  constructor(message = 'ProposalNotOpen') {
    super(message);
    Object.setPrototypeOf(this, ProposalNotOpenError.prototype);
  }
}
