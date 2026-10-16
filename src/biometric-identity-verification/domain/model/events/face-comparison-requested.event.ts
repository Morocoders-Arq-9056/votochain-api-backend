import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class FaceComparisonRequestedEvent implements DomainEvent {
  static readonly eventName = 'FaceComparisonRequested';
  readonly eventName = FaceComparisonRequestedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly profileId: BiometricProfileId,
  ) {}
}
