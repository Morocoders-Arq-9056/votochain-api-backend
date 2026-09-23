import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";

export class GetChallengeHistoryByPersonAndPurposeQuery {
  constructor(
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
  ) {
    if (!personId) throw new Error('personId required');
    if (!purpose) throw new Error('purpose required');
  }
}
