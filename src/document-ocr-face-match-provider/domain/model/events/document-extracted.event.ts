import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";

/** The document was read; readable or not, with a closed reason when not. */
export class DocumentExtractedEvent implements DomainEvent {
  static readonly eventName = 'DocumentExtracted';
  readonly eventName = DocumentExtractedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly examinationId: ExaminationId,
    public readonly readable: boolean,
    public readonly reason: string | null,
  ) {}
}
