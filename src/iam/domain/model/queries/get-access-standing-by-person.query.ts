import { PersonId } from "../valueobjects/person-id.js";

export class GetAccessStandingByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
