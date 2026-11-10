import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { DocumentExamination } from "../../../domain/model/aggregates/document-examination.aggregate.js";
import { ConsumeExaminationMatchCommand } from "../../../domain/model/commands/consume-examination-match.command.js";
import { ExamineDocumentExaminationCommand } from "../../../domain/model/commands/examine-document-examination.command.js";
import { ExpireDocumentExaminationCommand } from "../../../domain/model/commands/expire-document-examination.command.js";
import { RequestDocumentExaminationCommand } from "../../../domain/model/commands/request-document-examination.command.js";
import { RequestDocumentReexaminationCommand } from "../../../domain/model/commands/request-document-reexamination.command.js";
import { ExaminationId } from "../../../domain/model/valueobjects/examination-id.value-object.js";
import { ValidityWindow } from "../../../domain/model/valueobjects/validity-window.value-object.js";
import { Verdict } from "../../../domain/model/valueobjects/verdict.value-object.js";
import { ExaminationStanding } from "../../../domain/model/valueobjects/examination-standing.value-object.js";
import type { DocumentRef } from "../../../domain/model/valueobjects/document-ref.value-object.js";
import type { PersonId } from "../../../domain/model/valueobjects/person-id.value-object.js";
import { parseUnreadableReason } from "../../../domain/model/valueobjects/unreadable-reason.value-object.js";
import { ExaminationAlreadyOpenError } from "../../../domain/exceptions/examination-already-open.error.js";
import { NoOpenExaminationError } from "../../../domain/exceptions/no-open-examination.error.js";
import { NoEligibleMembershipError } from "../../../domain/exceptions/no-eligible-membership.error.js";
import { ContactNotAllowedError } from "../../../domain/exceptions/contact-not-allowed.error.js";
import { EXAMINATION_REPOSITORY } from "../../../domain/repositories/examination.repository.js";
import type { ExaminationRepository } from "../../../domain/repositories/examination.repository.js";
import type { ExaminationCommandService } from "../../../domain/services/examination-command.service.js";
import { ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";
import { ExternalMembershipService } from "../outboundservices/acl/external-membership.service.js";
import { EVIDENCE_STORE, type EvidenceStore } from "../outboundservices/evidence/evidence-store.service.js";
import { EXECUTOR_PORT } from "../outboundservices/executor/document-executor.service.js";
import type { DocumentExecutorService, EvidenceInput } from "../outboundservices/executor/document-executor.service.js";

/**
 * Application orchestration for the 4 examination writes.
 *
 * UC1 gates (Membership R8 belonging, Consent) run BEFORE `uow.run()`; the
 * transaction groups DB statements only. UC2 observes the executor (network,
 * outside the tx) then applies `record*` inside one UoW — the domain judges
 * the pipeline, never executes vendors. Events publish after each commit.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class ExaminationCommandServiceImpl implements ExaminationCommandService {
  constructor(
    @Inject(EXAMINATION_REPOSITORY) private readonly exams: ExaminationRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
    private readonly membership: ExternalMembershipService,
    private readonly consent: ExternalConsentService,
    @Inject(EXECUTOR_PORT) private readonly executor: DocumentExecutorService,
    @Optional() @Inject(EVIDENCE_STORE) private readonly evidenceStore?: EvidenceStore,
  ) {}

  async requestDocumentExamination(command: RequestDocumentExaminationCommand): Promise<ExaminationId> {
    if (!(await this.membership.belongsToAnyCommunity(command.personId.value)))
      throw new NoEligibleMembershipError('person belongs nowhere');
    if (!(await this.consent.mayProcessNow(command.personId.value)))
      throw new ContactNotAllowedError('processing not allowed now');
    const open = await this.exams.findOpenByPersonAndDocument(command.personId, command.documentRef);
    if (open) {
      // Scrutiny before the throw: the refusal is persisted in its own UoW so
      // it survives the 409.
      const noted = await this.uow.run(async () => {
        open.noteRefused('DUPLICATE');
        await this.exams.save(open);
        return open;
      });
      this.publish(noted);
      throw new ExaminationAlreadyOpenError('already OPEN');
    }
    const created = await this.uow.run(async () => {
      const e = DocumentExamination.request({
        id: ExaminationId.generate(),
        personId: command.personId,
        documentRef: command.documentRef,
        window: ValidityWindow.now(this.config.get<number>('ocr.ttlMinutes', 30)),
      });
      await this.exams.save(e);
      return e;
    });
    this.publish(created);
    return created.id;
  }

  async examineDocumentExamination(command: ExamineDocumentExaminationCommand): Promise<void> {
    const id = command.examinationId;
    let evidenceInput: EvidenceInput = id.value;
    if (this.evidenceStore) {
      const stored = await this.evidenceStore.take(id.value).catch(() => null);
      if (stored) evidenceInput = stored;
    }
    const extraction = await this.executor.observeExtraction(evidenceInput);
    const comparison = extraction.readable ? await this.executor.observeComparison(evidenceInput) : null;
    const concluded = await this.uow.run(async () => {
      const e = await this.require(id);
      e.recordExtraction(extraction.readable, extraction.reason ? parseUnreadableReason(extraction.reason) : null);
      if (!extraction.readable) {
        e.recordVerdict(Verdict.UNREADABLE);
      } else {
        e.recordComparison(comparison!.holds);
        e.recordVerdict(comparison!.holds ? Verdict.MATCH : Verdict.NO_MATCH);
      }
      await this.exams.save(e);
      return e;
    });
    this.publish(concluded);
  }

  async requestDocumentReexamination(command: RequestDocumentReexaminationCommand): Promise<ExaminationId> {
    const created = await this.uow.run(async () => {
      const prior = await this.require(command.priorExaminationId);
      const fresh = prior.requestReexamination(
        ExaminationId.generate(),
        ValidityWindow.now(this.config.get<number>('ocr.ttlMinutes', 30)),
      );
      await this.exams.save(fresh);
      return { prior, fresh };
    });
    this.publish(created.prior);
    this.publish(created.fresh);
    return created.fresh.id;
  }

  async expireDocumentExamination(command: ExpireDocumentExaminationCommand): Promise<void> {
    const expired = await this.uow.run(async () => {
      const e = await this.require(command.examinationId);
      e.expire(command.now);
      await this.exams.save(e);
      return e;
    });
    this.publish(expired);
  }

  async consumeExaminationMatch(command: ConsumeExaminationMatchCommand): Promise<boolean> {
    const found = command.documentRef
      ? await this.findUsable(command.personId, command.documentRef)
      : await this.findAnyUsable(command.personId);
    if (!found) return false;
    const consumed = await this.uow.run(async () => {
      const fresh = await this.exams.findById(found.id);
      if (!fresh || !fresh.answerStanding().usableMatch) return null;
      fresh.markConsumed();
      await this.exams.save(fresh);
      return fresh;
    });
    if (!consumed) return false;
    this.publish(consumed);
    return true;
  }

  private async require(id: ExaminationId): Promise<DocumentExamination> {
    const e = await this.exams.findById(id);
    if (!e) throw new NoOpenExaminationError('examination not found');
    return e;
  }

  private async findUsable(personId: PersonId, documentRef: DocumentRef): Promise<DocumentExamination | null> {
    const all = await this.exams.findAllByPersonAndDocument(personId, documentRef);
    return all.find(
      (e) => e.standing === ExaminationStanding.CONCLUDED && e.verdict === Verdict.MATCH && !e.consumed,
    ) ?? null;
  }

  private async findAnyUsable(personId: PersonId): Promise<DocumentExamination | null> {
    const all = await this.exams.findAllByPerson(personId);
    return all.find(
      (e) => e.standing === ExaminationStanding.CONCLUDED && e.verdict === Verdict.MATCH && !e.consumed,
    ) ?? null;
  }

  private publish(e: DocumentExamination): void {
    for (const event of e.pullDomainEvents()) this.events.emit(event.eventName, event);
  }
}
