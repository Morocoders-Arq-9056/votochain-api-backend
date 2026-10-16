import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class LivenessChallengeStartedEvent implements DomainEvent {
  static readonly eventName = 'LivenessChallengeStarted';
  readonly eventName = LivenessChallengeStartedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly personId: PersonId,
  ) {}
}
