import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";

export class GetUserByPersonIdQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
