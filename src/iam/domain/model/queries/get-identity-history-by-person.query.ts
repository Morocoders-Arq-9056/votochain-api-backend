import { PersonId } from "../valueobjects/person-id.js";

export class GetIdentityHistoryByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
