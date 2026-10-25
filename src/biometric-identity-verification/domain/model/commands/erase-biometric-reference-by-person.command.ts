import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Erasure command: revokes the person's live biometric reference (Law 29733
 * right to erasure, executed by the owning context on Consent coordination).
 * Idempotent: a person with no live reference erases zero.
 */
export class EraseBiometricReferenceByPersonCommand {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
