import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Erasure command: terminates every live membership held by one person
 * (Law 29733 right to erasure, executed by the owning context on Consent
 * coordination). Idempotent: a person with no live memberships erases zero.
 */
export class EraseMembershipsByPersonCommand {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
