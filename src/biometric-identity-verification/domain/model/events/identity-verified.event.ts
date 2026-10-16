import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { FreshnessWindow } from "../valueobjects/freshness-window.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

export class IdentityVerifiedEvent implements DomainEvent {
  static readonly eventName = 'IdentityVerified';
  readonly eventName = IdentityVerifiedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly personId: PersonId,
    public readonly freshness: FreshnessWindow,
  ) {}
}
