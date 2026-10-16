import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class LivenessPassedEvent implements DomainEvent {
  static readonly eventName = 'LivenessPassed';
  readonly eventName = LivenessPassedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(public readonly attemptId: VerificationAttemptId) {}
}
