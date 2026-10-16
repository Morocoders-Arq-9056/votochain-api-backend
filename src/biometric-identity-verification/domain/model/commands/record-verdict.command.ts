import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class RecordVerdictCommand {
  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly now: Date,
  ) {
    if (!attemptId) throw new Error('attemptId required');
  }
}
