import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class VerificationAttemptExpiredEvent implements DomainEvent {
  static readonly eventName = 'VerificationAttemptExpired';
  readonly eventName = VerificationAttemptExpiredEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly reason: FailureReason,
  ) {}
}
