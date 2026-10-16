import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class RequestComparisonCommand {
  constructor(public readonly attemptId: VerificationAttemptId) {
    if (!attemptId) throw new Error('attemptId required');
  }
}
