import { Injectable } from "@nestjs/common";
import { DocumentExamination } from "../../../../domain/model/aggregates/document-examination.aggregate.js";
import { DocumentRef } from "../../../../domain/model/valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../../../../domain/model/valueobjects/examination-id.value-object.js";
import { parseExaminationStanding } from "../../../../domain/model/valueobjects/examination-standing.value-object.js";
import { PersonId } from "../../../../domain/model/valueobjects/person-id.value-object.js";
import { ValidityWindow } from "../../../../domain/model/valueobjects/validity-window.value-object.js";
import { parseVerdict } from "../../../../domain/model/valueobjects/verdict.value-object.js";
import { ExaminationOrmEntity } from "../entities/examination.orm-entity.js";

/**
 * Translates between the DocumentExamination aggregate and its ORM shape.
 * ORM → domain parses every closed set through explicit parsers (never `as`).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class ExaminationPersistenceAssembler {
  toDomainFromOrm(entity: ExaminationOrmEntity): DocumentExamination {
    return DocumentExamination.rehydrate({
      id: ExaminationId.of(entity.id),
      personId: PersonId.of(entity.personId),
      documentRef: DocumentRef.of(entity.documentRef),
      standing: parseExaminationStanding(entity.standing),
      window: new ValidityWindow(entity.requestedAt, entity.ttlMinutes),
      verdict: entity.verdict ? parseVerdict(entity.verdict) : null,
      consumed: entity.consumed,
      extracted: true,
      compared: true,
    });
  }

  toOrmFromDomain(examination: DocumentExamination): ExaminationOrmEntity {
    const orm = new ExaminationOrmEntity();
    orm.id = examination.id.value;
    orm.personId = examination.personId.value;
    orm.documentRef = examination.documentRef.value;
    orm.standing = examination.standing;
    orm.verdict = examination.verdict;
    orm.consumed = examination.consumed;
    orm.requestedAt = examination.window.requestedAt;
    orm.ttlMinutes = examination.window.ttlMinutes;
    orm.unreadableReason = null;
    return orm;
  }
}
