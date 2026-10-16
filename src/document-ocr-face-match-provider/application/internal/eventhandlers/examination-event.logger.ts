import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DocumentExtractedEvent } from "../../../domain/model/events/document-extracted.event.js";
import { ExaminationConcludedEvent } from "../../../domain/model/events/examination-concluded.event.js";
import { ExaminationExpiredEvent } from "../../../domain/model/events/examination-expired.event.js";
import { ExaminationRefusedEvent } from "../../../domain/model/events/examination-refused.event.js";
import { ExaminationRequestedEvent } from "../../../domain/model/events/examination-requested.event.js";
import { FacesComparedEvent } from "../../../domain/model/events/faces-compared.event.js";
import { ReexaminationRequestedEvent } from "../../../domain/model/events/reexamination-requested.event.js";

/**
 * Observability only. Exempt from the `<Stem>EventHandler` rename: it is a
 * generic logger, not a handler of one event. Never subscribed from another
 * module; cross-BC reactions go through the published facade.
 */
@Injectable()
export class ExaminationEventLogger {
  private readonly logger = new Logger(ExaminationEventLogger.name);

  @OnEvent(ExaminationRequestedEvent.eventName, { async: true })
  onRequested(event: ExaminationRequestedEvent): void {
    this.logger.log(`examination requested ${event.examinationId.value}`);
  }

  @OnEvent(ExaminationRefusedEvent.eventName, { async: true })
  onRefused(event: ExaminationRefusedEvent): void {
    this.logger.warn(`examination refused ${event.examinationId.value}: ${event.reason}`);
  }

  @OnEvent(DocumentExtractedEvent.eventName, { async: true })
  onExtracted(event: DocumentExtractedEvent): void {
    this.logger.log(`document extracted ${event.examinationId.value}: readable=${event.readable}`);
  }

  @OnEvent(FacesComparedEvent.eventName, { async: true })
  onCompared(event: FacesComparedEvent): void {
    this.logger.log(`faces compared ${event.examinationId.value}: holds=${event.holds}`);
  }

  @OnEvent(ExaminationConcludedEvent.eventName, { async: true })
  onConcluded(event: ExaminationConcludedEvent): void {
    this.logger.log(`examination concluded ${event.examinationId.value}: ${event.verdict}`);
  }

  @OnEvent(ExaminationExpiredEvent.eventName, { async: true })
  onExpired(event: ExaminationExpiredEvent): void {
    this.logger.log(`examination expired ${event.examinationId.value}`);
  }

  @OnEvent(ReexaminationRequestedEvent.eventName, { async: true })
  onReexamination(event: ReexaminationRequestedEvent): void {
    this.logger.log(`reexamination ${event.newExaminationId.value} from ${event.priorExaminationId.value}`);
  }
}
