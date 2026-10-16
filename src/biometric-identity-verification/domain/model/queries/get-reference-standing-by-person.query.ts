import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetReferenceStandingByPersonQuery {
  constructor(public readonly personId: PersonId) {}
}
