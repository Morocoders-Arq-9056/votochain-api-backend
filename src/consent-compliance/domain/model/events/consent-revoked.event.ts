import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentRecordId } from "../valueobjects/consent-record-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";

function stamped() { return new Date(); }

export class ConsentRevokedEvent implements DomainEvent {
  static readonly eventName = 'ConsentRevoked';
  readonly eventName = ConsentRevokedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly recordId: ConsentRecordId, public readonly personId: PersonId, public readonly scope: ConsentScope) {}
}
