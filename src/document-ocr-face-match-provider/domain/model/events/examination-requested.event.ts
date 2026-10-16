import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DocumentRef } from "../valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/** Examination requested. No evidence travels — person + document only. */
export class ExaminationRequestedEvent implements DomainEvent {
  static readonly eventName = 'ExaminationRequested';
  readonly eventName = ExaminationRequestedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly personId: PersonId,
    public readonly documentRef: DocumentRef,
  ) {}
}
