import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";
import type { ErasureOwner } from "../valueobjects/erasure-owner.value-object.js";

function stamped() { return new Date(); }

export class RevocationCoordinatedEvent implements DomainEvent {
  static readonly eventName = 'RevocationCoordinated';
  readonly eventName = RevocationCoordinatedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId, public readonly owner: ErasureOwner) {}
}
