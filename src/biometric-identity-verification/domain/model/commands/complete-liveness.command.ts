import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class CompleteLivenessCommand {
  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly present: boolean,
  ) {
    if (!attemptId) throw new Error('attemptId required');
  }
}
