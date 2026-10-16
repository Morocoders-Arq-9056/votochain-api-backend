import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetSigningCapabilityByPersonQuery {
  constructor(public readonly personId: PersonId) {}
}
