import { VerificationAttempt } from './verification-attempt.aggregate.js';
import { AttemptStanding } from '../valueobjects/attempt-standing.value-object.js';
import { BiometricProfileId } from '../valueobjects/biometric-profile-id.value-object.js';
import { FailureReason } from '../valueobjects/failure-reason.value-object.js';
import { FreshnessWindow } from '../valueobjects/freshness-window.value-object.js';
import { PersonId } from '../valueobjects/person-id.value-object.js';
import { VerificationAttemptId } from '../valueobjects/verification-attempt-id.value-object.js';
import { FaceComparisonRequestedEvent } from '../events/face-comparison-requested.event.js';
import { IdentityVerificationFailedEvent } from '../events/identity-verification-failed.event.js';
import { IdentityVerifiedEvent } from '../events/identity-verified.event.js';
import { LivenessChallengeStartedEvent } from '../events/liveness-challenge-started.event.js';
import { LivenessFailedEvent } from '../events/liveness-failed.event.js';
import { LivenessPassedEvent } from '../events/liveness-passed.event.js';
import { AttemptConcludedError } from '../../exceptions/attempt-concluded.error.js';
import { ReferenceEndedError } from '../../exceptions/reference-ended.error.js';

function openAttempt(): VerificationAttempt {
  const a = VerificationAttempt.start({
    id: VerificationAttemptId.generate(),
    personId: PersonId.generate(),
    profileId: BiometricProfileId.generate(),
    freshness: FreshnessWindow.singleUse(15),
  });
  a.pullDomainEvents();
  return a;
}

describe('VerificationAttempt aggregate', () => {
  it('starts CHALLENGE_OPEN emitting LivenessChallengeStartedEvent', () => {
    const a = VerificationAttempt.start({
      id: VerificationAttemptId.generate(),
      personId: PersonId.generate(),
      profileId: BiometricProfileId.generate(),
      freshness: FreshnessWindow.singleUse(15),
    });

    expect(a.standing).toBe(AttemptStanding.CHALLENGE_OPEN);
    const events = a.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(LivenessChallengeStartedEvent);
  });

  it('runs liveness → comparison → VERIFIED with a stamped freshness window', () => {
    const a = openAttempt();

    a.completeLiveness(true);
    expect(a.standing).toBe(AttemptStanding.LIVENESS_PASSED);

    a.requestComparison(true);
    expect(a.standing).toBe(AttemptStanding.COMPARISON_REQUESTED);

    const now = new Date();
    a.recordVerdict(true, now);
    expect(a.standing).toBe(AttemptStanding.VERIFIED);
    expect(a.answerStanding(now)).toEqual({ verifiedNow: true, reason: null });

    const events = a.pullDomainEvents();
    expect(events.map((x) => x.constructor)).toEqual([
      LivenessPassedEvent,
      FaceComparisonRequestedEvent,
      IdentityVerifiedEvent,
    ]);
  });

  it('ages out a VERIFIED verdict past its freshness window', () => {
    const a = openAttempt();
    a.completeLiveness(true);
    a.requestComparison(true);
    const now = new Date();
    a.recordVerdict(true, now);
    a.pullDomainEvents();

    const late = new Date(now.getTime() + 16 * 60000);
    expect(a.answerStanding(late).verifiedNow).toBe(false);
  });

  it('freezes NOT_VERIFIED with NO_MATCH on a negative comparison', () => {
    const a = openAttempt();
    a.completeLiveness(true);
    a.requestComparison(true);

    a.recordVerdict(false, new Date());

    expect(a.standing).toBe(AttemptStanding.NOT_VERIFIED);
    expect(a.answerStanding(new Date()).verifiedNow).toBe(false);
    expect(a.pullDomainEvents()[2]).toBeInstanceOf(IdentityVerificationFailedEvent);
  });

  it('fails the attempt terminally when no liveness is observed', () => {
    const a = openAttempt();

    a.completeLiveness(false);

    expect(a.standing).toBe(AttemptStanding.LIVENESS_FAILED);
    expect(a.pullDomainEvents()[0]).toBeInstanceOf(LivenessFailedEvent);
  });

  it('refuses comparison without passed liveness', () => {
    const a = openAttempt();

    expect(() => a.requestComparison(true)).toThrow(AttemptConcludedError);
  });

  it('refuses comparison when the reference ended', () => {
    const a = openAttempt();
    a.completeLiveness(true);

    expect(() => a.requestComparison(false)).toThrow(ReferenceEndedError);
  });

  it('expires an open attempt and never rewrites a verdict', () => {
    const a = openAttempt();
    a.completeLiveness(true);
    a.requestComparison(true);
    a.recordVerdict(false, new Date());
    a.pullDomainEvents();

    a.expire(FailureReason.ATTEMPT_EXPIRED);

    expect(a.standing).toBe(AttemptStanding.NOT_VERIFIED);
    expect(a.pullDomainEvents()).toHaveLength(0);
  });
});
