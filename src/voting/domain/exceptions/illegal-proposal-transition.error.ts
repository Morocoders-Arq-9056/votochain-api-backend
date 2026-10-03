export class IllegalProposalTransitionError extends Error {
  constructor(message = 'illegal proposal transition') {
    super(message);
    Object.setPrototypeOf(this, IllegalProposalTransitionError.prototype);
  }
}
