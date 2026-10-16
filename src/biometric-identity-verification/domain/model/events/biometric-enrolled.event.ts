import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

export class BiometricEnrolledEvent implements DomainEvent {
  static readonly eventName = 'BiometricEnrolled';
  readonly eventName = BiometricEnrolledEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly profileId: BiometricProfileId,
    public readonly personId: PersonId,
  ) {}
}
