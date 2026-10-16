import { DocumentExamination } from './document-examination.aggregate.js';
import { DocumentRef } from '../valueobjects/document-ref.value-object.js';
import { ExaminationId } from '../valueobjects/examination-id.value-object.js';
import { ExaminationStanding } from '../valueobjects/examination-standing.value-object.js';
import { PersonId } from '../valueobjects/person-id.value-object.js';
import { ValidityWindow } from '../valueobjects/validity-window.value-object.js';
import { Verdict } from '../valueobjects/verdict.value-object.js';
import { DocumentExtractedEvent } from '../events/document-extracted.event.js';
import { ExaminationConcludedEvent } from '../events/examination-concluded.event.js';
import { ExaminationRefusedEvent } from '../events/examination-refused.event.js';
import { ExaminationRequestedEvent } from '../events/examination-requested.event.js';
import { FacesComparedEvent } from '../events/faces-compared.event.js';
import { ExaminationAlreadyOpenError } from '../../exceptions/examination-already-open.error.js';
import { ExaminationConcludedError } from '../../exceptions/examination-concluded.error.js';
import { NoOpenExaminationError } from '../../exceptions/no-open-examination.error.js';

function openExamination(): DocumentExamination {
  const e = DocumentExamination.request({
    id: ExaminationId.generate(),
    personId: PersonId.generate(),
    documentRef: DocumentRef.of('dni-12345678'),
    window: ValidityWindow.now(30),
  });
  e.pullDomainEvents();
  return e;
}

describe('DocumentExamination aggregate', () => {
  it('requests OPEN emitting ExaminationRequestedEvent', () => {
    const e = DocumentExamination.request({
      id: ExaminationId.generate(),
      personId: PersonId.generate(),
      documentRef: DocumentRef.of('dni-1'),
      window: ValidityWindow.now(30),
    });

    expect(e.standing).toBe(ExaminationStanding.OPEN);
    expect(e.answerStanding()).toEqual({ usableMatch: false });

    const events = e.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ExaminationRequestedEvent);
  });

  it('runs the linear pipeline extraction → comparison → MATCH verdict', () => {
    const e = openExamination();

    e.recordExtraction(true, null);
    e.recordComparison(true);
    e.recordVerdict(Verdict.MATCH);

    expect(e.standing).toBe(ExaminationStanding.CONCLUDED);
    expect(e.answerStanding()).toEqual({ usableMatch: true });

    const events = e.pullDomainEvents();
    expect(events.map((x) => x.constructor)).toEqual([
      DocumentExtractedEvent,
      FacesComparedEvent,
      ExaminationConcludedEvent,
    ]);
  });

  it('concludes UNREADABLE when the read fails', () => {
    const e = openExamination();

    e.recordExtraction(false, 'BLURRY');
    e.recordVerdict(Verdict.UNREADABLE);

    expect(e.standing).toBe(ExaminationStanding.CONCLUDED);
    expect(e.answerStanding()).toEqual({ usableMatch: false });
  });

  it('refuses a comparison without a clean read', () => {
    const e = openExamination();

    expect(() => e.recordComparison(true)).toThrow(NoOpenExaminationError);
  });

  it('notes a duplicate refusal as scrutiny without transitioning', () => {
    const e = openExamination();

    e.noteRefused('DUPLICATE');

    expect(e.standing).toBe(ExaminationStanding.OPEN);
    const events = e.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ExaminationRefusedEvent);
  });

  it('refuses every mutation once concluded', () => {
    const e = openExamination();
    e.recordExtraction(true, null);
    e.recordComparison(true);
    e.recordVerdict(Verdict.NO_MATCH);
    e.pullDomainEvents();

    expect(() => e.recordExtraction(true, null)).toThrow(ExaminationConcludedError);
    expect(() => e.recordVerdict(Verdict.MATCH)).toThrow(ExaminationConcludedError);
  });

  it('consumes the MATCH single-use: a second consume stops answering usable', () => {
    const e = openExamination();
    e.recordExtraction(true, null);
    e.recordComparison(true);
    e.recordVerdict(Verdict.MATCH);
    e.pullDomainEvents();

    expect(e.answerStanding()).toEqual({ usableMatch: true });
    e.markConsumed();
    expect(e.answerStanding()).toEqual({ usableMatch: false });
  });

  it('expires only past the window and never re-expires a terminal', () => {
    const e = openExamination();

    expect(() => e.expire(new Date())).toThrow(ExaminationConcludedError);

    e.expire(new Date(Date.now() + 31 * 60000));
    expect(e.standing).toBe(ExaminationStanding.EXPIRED);

    e.pullDomainEvents();
    e.expire(new Date(Date.now() + 60 * 60000));
    expect(e.pullDomainEvents()).toHaveLength(0);
  });

  it('reexamines a terminal examination with a fresh linked identity', () => {
    const prior = openExamination();
    prior.recordExtraction(true, null);
    prior.recordComparison(false);
    prior.recordVerdict(Verdict.NO_MATCH);
    prior.pullDomainEvents();

    const fresh = prior.requestReexamination(ExaminationId.generate(), ValidityWindow.now(30));

    expect(fresh.id.equals(prior.id)).toBe(false);
    expect(fresh.standing).toBe(ExaminationStanding.OPEN);
    expect(prior.standing).toBe(ExaminationStanding.CONCLUDED);
  });

  it('refuses reexamination while OPEN', () => {
    const e = openExamination();

    expect(() => e.requestReexamination(ExaminationId.generate(), ValidityWindow.now(30)))
      .toThrow(ExaminationAlreadyOpenError);
  });
});
