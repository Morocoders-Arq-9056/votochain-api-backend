import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class GetVerificationAttemptByIdQuery {
  constructor(public readonly attemptId: VerificationAttemptId) {}
}
