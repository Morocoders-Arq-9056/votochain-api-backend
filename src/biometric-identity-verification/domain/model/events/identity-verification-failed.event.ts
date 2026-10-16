import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class IdentityVerificationFailedEvent implements DomainEvent {
  static readonly eventName = 'IdentityVerificationFailed';
  readonly eventName = IdentityVerificationFailedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly personId: PersonId,
    public readonly reason: FailureReason,
  ) {}
}
