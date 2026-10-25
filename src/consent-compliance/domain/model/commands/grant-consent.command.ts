import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";
import type { PolicyVersion } from "../valueobjects/policy-version.value-object.js";

export class GrantConsentCommand {
  constructor(public readonly personId: PersonId, public readonly scope: ConsentScope, public readonly policyVersion: PolicyVersion) {
    if (!personId || !scope || !policyVersion) throw new Error('person+scope+policyVersion required');
  }
}
