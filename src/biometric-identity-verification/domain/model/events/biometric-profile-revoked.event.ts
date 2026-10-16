import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

export class BiometricProfileRevokedEvent implements DomainEvent {
  static readonly eventName = 'BiometricProfileRevoked';
  readonly eventName = BiometricProfileRevokedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly profileId: BiometricProfileId,
    public readonly personId: PersonId,
  ) {}
}
