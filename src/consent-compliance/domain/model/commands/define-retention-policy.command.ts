import type { DataCategory } from "../valueobjects/data-category.value-object.js";
import type { RetentionTerms } from "../valueobjects/retention-terms.value-object.js";
import { PolicySupersedes } from "../valueobjects/policy-supersedes.value-object.js";

export class DefineRetentionPolicyCommand {
  constructor(public readonly category: DataCategory, public readonly terms: RetentionTerms, public readonly supersedes: PolicySupersedes | null) {
    if (!category || !terms) throw new Error('category+terms required');
  }
}
