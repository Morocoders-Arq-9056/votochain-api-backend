import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetSystemRolesByPersonQuery {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
