import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/** A request refused as a duplicate of an already-OPEN examination. */
export class ExaminationRefusedEvent implements DomainEvent {
  static readonly eventName = 'ExaminationRefused';
  readonly eventName = ExaminationRefusedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly personId: PersonId,
    public readonly reason: string,
  ) {}
}
