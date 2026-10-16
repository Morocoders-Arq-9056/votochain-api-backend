import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentRecordId } from "../valueobjects/consent-record-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { PolicyVersion } from "../valueobjects/policy-version.value-object.js";
import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";
import type { RetentionPolicyId } from "../valueobjects/retention-policy-id.value-object.js";
import type { DataCategory } from "../valueobjects/data-category.value-object.js";
import type { RetentionTerms } from "../valueobjects/retention-terms.value-object.js";

function stamped() { return new Date(); }

export class ConsentGrantedEvent implements DomainEvent {
  static readonly eventName = 'ConsentGranted';
  readonly eventName = ConsentGrantedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly recordId: ConsentRecordId, public readonly personId: PersonId, public readonly scope: ConsentScope, public readonly policyVersion: PolicyVersion) {}
}

export class ConsentRevokedEvent implements DomainEvent {
  static readonly eventName = 'ConsentRevoked';
  readonly eventName = ConsentRevokedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly recordId: ConsentRecordId, public readonly personId: PersonId, public readonly scope: ConsentScope) {}
}

export class RetentionPolicyDefinedEvent implements DomainEvent {
  static readonly eventName = 'RetentionPolicyDefined';
  readonly eventName = RetentionPolicyDefinedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly policyId: RetentionPolicyId, public readonly category: DataCategory, public readonly terms: RetentionTerms, public readonly supersedes: string | null) {}
}

export class ErasureRequestedEvent implements DomainEvent {
  static readonly eventName = 'ErasureRequested';
  readonly eventName = ErasureRequestedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId) {}
}

export class ErasureConfirmedEvent implements DomainEvent {
  static readonly eventName = 'ErasureConfirmed';
  readonly eventName = ErasureConfirmedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId) {}
}

export class RevocationCoordinatedEvent implements DomainEvent {
  static readonly eventName = 'RevocationCoordinated';
  readonly eventName = RevocationCoordinatedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId, public readonly owner: string) {}
}

export class RevocationConfirmedEvent implements DomainEvent {
  static readonly eventName = 'RevocationConfirmed';
  readonly eventName = RevocationConfirmedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId, public readonly owner: string) {}
}

export class ErasureCompletedEvent implements DomainEvent {
  static readonly eventName = 'ErasureCompleted';
  readonly eventName = ErasureCompletedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly requestId: DataSubjectRequestId, public readonly personId: PersonId) {}
}
