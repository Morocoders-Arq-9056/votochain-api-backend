import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

/** The portrait-vs-face judgment: holds or does not. No scores cross. */
export class FacesComparedEvent implements DomainEvent {
  static readonly eventName = 'FacesCompared';
  readonly eventName = FacesComparedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly holds: boolean,
  ) {}
}
