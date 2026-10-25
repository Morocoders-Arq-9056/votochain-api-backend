import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { RetentionPolicyId } from "../valueobjects/retention-policy-id.value-object.js";
import type { DataCategory } from "../valueobjects/data-category.value-object.js";
import type { RetentionTerms } from "../valueobjects/retention-terms.value-object.js";
import type { PolicySupersedes } from "../valueobjects/policy-supersedes.value-object.js";

function stamped() { return new Date(); }

export class RetentionPolicyDefinedEvent implements DomainEvent {
  static readonly eventName = 'RetentionPolicyDefined';
  readonly eventName = RetentionPolicyDefinedEvent.eventName;
  readonly occurredAt = stamped();
  constructor(public readonly policyId: RetentionPolicyId, public readonly category: DataCategory, public readonly terms: RetentionTerms, public readonly supersedes: PolicySupersedes | null) {}
}
