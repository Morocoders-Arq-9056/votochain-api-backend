export class ProposalNotFoundError extends Error {
  constructor(message = 'proposal not found') {
    super(message);
    Object.setPrototypeOf(this, ProposalNotFoundError.prototype);
  }
}
