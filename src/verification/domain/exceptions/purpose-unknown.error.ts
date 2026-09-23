export class PurposeUnknownError extends Error {
  constructor(message = 'purpose unknown') {
    super(message);
    Object.setPrototypeOf(this, PurposeUnknownError.prototype);
  }
}
