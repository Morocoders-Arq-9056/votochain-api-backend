import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";

function stamped() { return new Date(); }

export class ErasureRequestedEvent implements DomainEvent {
  static readonly eventName = 'ErasureRequested';
  readonly eventName = ErasureRequestedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId) {}
}
