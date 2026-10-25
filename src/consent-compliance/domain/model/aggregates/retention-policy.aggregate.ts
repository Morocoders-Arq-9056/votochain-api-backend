import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import type { DataCategory } from "../valueobjects/data-category.value-object.js";
import type { RetentionPolicyId } from "../valueobjects/retention-policy-id.value-object.js";
import type { RetentionTerms } from "../valueobjects/retention-terms.value-object.js";
import type { PolicySupersedes } from "../valueobjects/policy-supersedes.value-object.js";
import { RetentionPolicyDefinedEvent } from "../events/consent.events.js";

/**
 * Keeping rule for one data category. Supersedes, never edits the past.
 * Confirmed erasure beats retention by default.
 */
export class RetentionPolicy extends AggregateRoot {
  private constructor(
    private readonly _id: RetentionPolicyId,
    private readonly _category: DataCategory,
    private readonly _terms: RetentionTerms,
    private readonly _supersedes: PolicySupersedes | null,
  ) { super(); }

  static define(p: { id: RetentionPolicyId; category: DataCategory; terms: RetentionTerms; supersedes: PolicySupersedes | null }): RetentionPolicy {
    const r = new RetentionPolicy(p.id, p.category, p.terms, p.supersedes);
    r.registerEvent(new RetentionPolicyDefinedEvent(r._id, r._category, r._terms, r._supersedes));
    return r;
  }

  static rehydrate(p: { id: RetentionPolicyId; category: DataCategory; terms: RetentionTerms; supersedes: PolicySupersedes | null }): RetentionPolicy {
    return new RetentionPolicy(p.id, p.category, p.terms, p.supersedes);
  }

  answerTerms(): { category: string; terms: RetentionTerms } {
    return { category: this._category.value, terms: this._terms };
  }

  get id(): RetentionPolicyId { return this._id; }
  get category(): DataCategory { return this._category; }
  get supersedes(): PolicySupersedes | null { return this._supersedes; }
}
