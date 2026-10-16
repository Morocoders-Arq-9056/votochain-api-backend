import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../shared/domain/repositories/unit-of-work.js";
import { DocumentExamination } from "../../domain/model/aggregates/document-examination.aggregate.js";
import { DocumentRef } from "../../domain/model/valueobjects/document-ref.value-object.js";
import { ExaminationStanding } from "../../domain/model/valueobjects/examination-standing.value-object.js";
import { PersonId } from "../../domain/model/valueobjects/person-id.value-object.js";
import { Verdict } from "../../domain/model/valueobjects/verdict.value-object.js";
import { EXAMINATION_REPOSITORY } from "../../domain/repositories/examination.repository.js";
import type { ExaminationRepository } from "../../domain/repositories/examination.repository.js";
import type { OcrContextFacade } from "../../interfaces/acl/ocr-context.facade.js";

/**
 * Application implementation of the published {@link OcrContextFacade}.
 * Translates boundary primitives into domain VOs and delegates to the
 * repository, consuming the single-use MATCH within its own unit of work.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class OcrContextFacadeImpl implements OcrContextFacade {
  constructor(
    @Inject(EXAMINATION_REPOSITORY) private readonly exams: ExaminationRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async answerUsableMatch(personId: string, documentRef: string): Promise<{ usableMatch: boolean }> {
    const found = await this.findUsable(personId, documentRef);
    return { usableMatch: found !== null && found.answerStanding().usableMatch };
  }

  async consumeMatch(personId: string, documentRef: string): Promise<boolean> {
    const found = await this.findUsable(personId, documentRef);
    return this.consume(found);
  }

  async consumeAnyUsableMatch(personId: string): Promise<boolean> {
    const all = await this.exams.findAllByPerson(PersonId.of(personId));
    const found = all.find(
      (e) => e.standing === ExaminationStanding.CONCLUDED && e.verdict === Verdict.MATCH && !e.consumed,
    ) ?? null;
    return this.consume(found);
  }

  private async consume(found: DocumentExamination | null): Promise<boolean> {
    if (!found) return false;
    const consumed = await this.uow.run(async () => {
      const fresh = await this.exams.findById(found.id);
      if (!fresh || !fresh.answerStanding().usableMatch) return null;
      fresh.markConsumed();
      await this.exams.save(fresh);
      return fresh;
    });
    if (!consumed) return false;
    for (const event of consumed.pullDomainEvents()) this.events.emit(event.eventName, event);
    return true;
  }

  private async findUsable(personId: string, documentRef: string): Promise<DocumentExamination | null> {
    const all = await this.exams.findAllByPersonAndDocument(PersonId.of(personId), DocumentRef.of(documentRef));
    return all.find(
      (e) => e.standing === ExaminationStanding.CONCLUDED && e.verdict === Verdict.MATCH && !e.consumed,
    ) ?? null;
  }
}
