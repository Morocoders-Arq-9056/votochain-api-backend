import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Erasure command: retires the person's live signing capability (Law 29733
 * right to erasure, executed by the owning context on Consent coordination).
 * Idempotent: a person with no live capability retires zero.
 */
export class RetireWalletByPersonCommand {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
