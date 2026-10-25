import { PersonReference } from "../valueobjects/person-reference.value-object.js";

/**
 * Erasure command: scrubs person-linked render values from every dispatch
 * that references one person. Idempotent: no referencing dispatch scrubs zero.
 */
export class ScrubDispatchesByPersonCommand {
  constructor(public readonly person: PersonReference) {
    if (!person) throw new Error('person required');
  }
}
