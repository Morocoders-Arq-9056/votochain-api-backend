import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

/** A fresh linked examination was born from a terminal one. */
export class ReexaminationRequestedEvent implements DomainEvent {
  static readonly eventName = 'ReexaminationRequested';
  readonly eventName = ReexaminationRequestedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly priorExaminationId: ExaminationId,
    public readonly newExaminationId: ExaminationId,
  ) {}
}
