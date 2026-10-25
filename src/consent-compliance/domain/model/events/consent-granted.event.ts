import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentRecordId } from "../valueobjects/consent-record-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { PolicyVersion } from "../valueobjects/policy-version.value-object.js";

function stamped() { return new Date(); }

export class ConsentGrantedEvent implements DomainEvent {
  static readonly eventName = 'ConsentGranted';
  readonly eventName = ConsentGrantedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly recordId: ConsentRecordId, public readonly personId: PersonId, public readonly scope: ConsentScope, public readonly policyVersion: PolicyVersion) {}
}
