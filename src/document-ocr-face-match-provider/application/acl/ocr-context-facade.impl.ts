import { Inject, Injectable } from "@nestjs/common";
import { DocumentRef } from "../../domain/model/valueobjects/document-ref.value-object.js";
import { ExaminationStanding } from "../../domain/model/valueobjects/examination-standing.value-object.js";
import { PersonId } from "../../domain/model/valueobjects/person-id.value-object.js";
import { Verdict } from "../../domain/model/valueobjects/verdict.value-object.js";
import { ConsumeExaminationMatchCommand } from "../../domain/model/commands/consume-examination-match.command.js";
import { EXAMINATION_REPOSITORY } from "../../domain/repositories/examination.repository.js";
import type { ExaminationRepository } from "../../domain/repositories/examination.repository.js";
import { EXAMINATION_COMMAND_SERVICE } from "../../domain/services/examination-command.service.js";
import type { ExaminationCommandService } from "../../domain/services/examination-command.service.js";
import type { OcrContextFacade } from "../../interfaces/acl/ocr-context.facade.js";

/**
 * Thin ACL translation: boundary primitives → domain VOs.
 * Reads probe the repository directly (no UoW, no events); the single-use
 * consume write delegates to `ExaminationCommandService` (UoW + publish
 * live there, never in the facade).
 */
@Injectable()
export class OcrContextFacadeImpl implements OcrContextFacade {
  constructor(
    @Inject(EXAMINATION_REPOSITORY) private readonly exams: ExaminationRepository,
    @Inject(EXAMINATION_COMMAND_SERVICE) private readonly commands: ExaminationCommandService,
  ) {}

  async answerUsableMatch(personId: string, documentRef: string): Promise<{ usableMatch: boolean }> {
    const all = await this.exams.findAllByPersonAndDocument(
      PersonId.of(personId),
      DocumentRef.of(documentRef),
    );
    const found = all.find(
      (e) => e.standing === ExaminationStanding.CONCLUDED && e.verdict === Verdict.MATCH && !e.consumed,
    ) ?? null;
    return { usableMatch: found !== null && found.answerStanding().usableMatch };
  }

  async consumeMatch(personId: string, documentRef: string): Promise<boolean> {
    return this.commands.consumeExaminationMatch(
      new ConsumeExaminationMatchCommand(PersonId.of(personId), DocumentRef.of(documentRef)),
    );
  }

  async consumeAnyUsableMatch(personId: string): Promise<boolean> {
    return this.commands.consumeExaminationMatch(
      new ConsumeExaminationMatchCommand(PersonId.of(personId), null),
    );
  }
}
