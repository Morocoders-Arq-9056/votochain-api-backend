import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";
import { Verdict } from "../valueobjects/verdict.value-object.js";

/** The single judgment; the push Biometric consumes single-use (R7). */
export class ExaminationConcludedEvent implements DomainEvent {
  static readonly eventName = 'ExaminationConcluded';
  readonly eventName = ExaminationConcludedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly verdict: Verdict,
  ) {}
}
