import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { ExaminationConcludedError } from "../../exceptions/examination-concluded.error.js";
import { ExaminationAlreadyOpenError } from "../../exceptions/examination-already-open.error.js";
import { NoOpenExaminationError } from "../../exceptions/no-open-examination.error.js";
import { DocumentExtractedEvent } from "../events/document-extracted.event.js";
import { ExaminationConcludedEvent } from "../events/examination-concluded.event.js";
import { ExaminationExpiredEvent } from "../events/examination-expired.event.js";
import { ExaminationRefusedEvent } from "../events/examination-refused.event.js";
import { ExaminationRequestedEvent } from "../events/examination-requested.event.js";
import { FacesComparedEvent } from "../events/faces-compared.event.js";
import { ReexaminationRequestedEvent } from "../events/reexamination-requested.event.js";
import { DocumentRef } from "../valueobjects/document-ref.value-object.js";
import { ExaminationId } from "../valueobjects/examination-id.value-object.js";
import { ExaminationStanding } from "../valueobjects/examination-standing.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UnreadableReason } from "../valueobjects/unreadable-reason.value-object.js";
import { ValidityWindow } from "../valueobjects/validity-window.value-object.js";
import { Verdict } from "../valueobjects/verdict.value-object.js";

/**
 * Lifecycle contract: linear pipeline, no reusable skeleton. The order is
 * imposed by the aggregate with explicit guards (`assertOpen`, `_extracted`).
 */
export interface Examinable {
  recordExtraction(readable: boolean, reason: UnreadableReason | null): void;
  recordComparison(holds: boolean): void;
  recordVerdict(v: Verdict): void;
  noteRefused(reason: string): void;
  expire(now: Date): void;
}

/**
 * DocumentExamination aggregate: one concrete proof for one (person,
 * document). `OPEN → CONCLUDED (MATCH|NO_MATCH|UNREADABLE)` or
 * `OPEN → EXPIRED`. Terminal; a reexamination is a fresh linked identity,
 * never a transition. Evidence dies with the examination — nothing
 * image-like is ever held or emitted.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class DocumentExamination extends AggregateRoot implements Examinable {
  private constructor(
    private readonly _id: ExaminationId,
    private readonly _personId: PersonId,
    private readonly _documentRef: DocumentRef,
    private _standing: ExaminationStanding,
    private readonly _window: ValidityWindow,
    private _verdict: Verdict | null = null,
    private _consumed = false,
    private _extracted = false,
    private _compared = false,
  ) { super(); }

  static request(input: {
    id: ExaminationId; personId: PersonId; documentRef: DocumentRef; window: ValidityWindow;
  }): DocumentExamination {
    const e = new DocumentExamination(
      input.id, input.personId, input.documentRef, ExaminationStanding.OPEN, input.window,
    );
    e.registerEvent(new ExaminationRequestedEvent(e._id, e._personId, e._documentRef));
    return e;
  }

  static rehydrate(input: {
    id: ExaminationId; personId: PersonId; documentRef: DocumentRef; standing: ExaminationStanding;
    window: ValidityWindow; verdict: Verdict | null; consumed: boolean; extracted: boolean; compared: boolean;
  }): DocumentExamination {
    return new DocumentExamination(
      input.id, input.personId, input.documentRef, input.standing, input.window,
      input.verdict, input.consumed, input.extracted, input.compared,
    );
  }

  recordExtraction(readable: boolean, reason: UnreadableReason | null): void {
    this.assertOpen();
    this._extracted = true;
    this.registerEvent(new DocumentExtractedEvent(this._id, readable, reason));
  }

  recordComparison(holds: boolean): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('comparison without clean read');
    this._compared = true;
    this.registerEvent(new FacesComparedEvent(this._id, holds));
  }

  recordVerdict(v: Verdict): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('verdict without extraction');
    this._verdict = v;
    this._standing = ExaminationStanding.CONCLUDED;
    this.registerEvent(new ExaminationConcludedEvent(this._id, v));
  }

  noteRefused(reason: string): void {
    this.assertOpen();
    this.registerEvent(new ExaminationRefusedEvent(this._id, this._personId, reason));
  }

  expire(now: Date): void {
    if (this._standing !== ExaminationStanding.OPEN) return;
    if (!this._window.isElapsed(now)) throw new ExaminationConcludedError('window still answerable');
    this._standing = ExaminationStanding.EXPIRED;
    this.registerEvent(new ExaminationExpiredEvent(this._id, this._personId));
  }

  requestReexamination(newId: ExaminationId, window: ValidityWindow): DocumentExamination {
    if (this._standing === ExaminationStanding.OPEN)
      throw new ExaminationAlreadyOpenError('one OPEN per person+doc');
    const fresh = new DocumentExamination(
      newId, this._personId, this._documentRef, ExaminationStanding.OPEN, window,
    );
    fresh.registerEvent(new ReexaminationRequestedEvent(this._id, newId));
    return fresh;
  }

  answerStanding(): { usableMatch: boolean } {
    return {
      usableMatch:
        this._standing === ExaminationStanding.CONCLUDED
        && this._verdict === Verdict.MATCH
        && !this._consumed,
    };
  }

  markConsumed(): void { this._consumed = true; }

  private assertOpen(): void {
    if (this._standing !== ExaminationStanding.OPEN)
      throw new ExaminationConcludedError('not OPEN');
  }

  get id(): ExaminationId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get documentRef(): DocumentRef { return this._documentRef; }
  get standing(): ExaminationStanding { return this._standing; }
  get window(): ValidityWindow { return this._window; }
  get verdict(): Verdict | null { return this._verdict; }
  get consumed(): boolean { return this._consumed; }
  get extracted(): boolean { return this._extracted; }
  get compared(): boolean { return this._compared; }
}
