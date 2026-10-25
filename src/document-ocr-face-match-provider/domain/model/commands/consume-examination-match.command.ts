import { DocumentRef } from "../valueobjects/document-ref.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Consumes the single-use MATCH for one person (optionally scoped to one
 * document). `documentRef = null` means any usable MATCH for the person.
 * One command → one service method `consumeExaminationMatch`.
 */
export class ConsumeExaminationMatchCommand {
  constructor(
    public readonly personId: PersonId,
    public readonly documentRef: DocumentRef | null,
  ) {
    if (!personId) throw new Error('person required');
  }
}
