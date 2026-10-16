import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/** The examination aged out without reaching a verdict. */
export class ExaminationExpiredEvent implements DomainEvent {
  static readonly eventName = 'ExaminationExpired';
  readonly eventName = ExaminationExpiredEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly personId: PersonId,
  ) {}
}
