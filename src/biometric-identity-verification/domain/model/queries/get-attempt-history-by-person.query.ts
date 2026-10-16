import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetAttemptHistoryByPersonQuery {
  constructor(public readonly personId: PersonId) {}
}
