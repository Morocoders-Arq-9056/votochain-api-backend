import type { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import type { ConsentScope } from "../valueobjects/consent-scope.value-object.js";

export class RevokeConsentCommand {
  constructor(public readonly personId: PersonId, public readonly scope: ConsentScope) {
    if (!personId || !scope) throw new Error('person+scope required');
  }
}
