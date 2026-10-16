import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { DataCategory } from "../valueobjects/data-category.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { PolicyVersion } from "../valueobjects/policy-version.value-object.js";
import type { RetentionTerms } from "../valueobjects/retention-terms.value-object.js";
import type { DataSubjectRequestId } from "../valueobjects/data-subject-request-id.value-object.js";

export class GrantConsentCommand {
  constructor(public readonly personId: PersonId, public readonly scope: ConsentScope, public readonly policyVersion: PolicyVersion) {
    if (!personId || !scope || !policyVersion) throw new Error('person+scope+policyVersion required');
  }
}

export class RevokeConsentCommand {
  constructor(public readonly personId: PersonId, public readonly scope: ConsentScope) {
    if (!personId || !scope) throw new Error('person+scope required');
  }
}

export class SubmitErasureRequestCommand {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('person required');
  }
}

export class ConfirmErasureRequestCommand {
  constructor(public readonly requestId: DataSubjectRequestId) {
    if (!requestId) throw new Error('requestId required');
  }
}

export class RecordRevocationConfirmationCommand {
  constructor(public readonly requestId: DataSubjectRequestId, public readonly owner: string) {
    if (!requestId || !owner?.trim()) throw new Error('requestId+owner required');
  }
}

export class DefineRetentionPolicyCommand {
  constructor(public readonly category: DataCategory, public readonly terms: RetentionTerms, public readonly supersedes: string | null) {
    if (!category || !terms) throw new Error('category+terms required');
  }
}
