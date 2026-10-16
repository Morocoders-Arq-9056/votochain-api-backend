import { VerificationChallenge } from '../../../../src/verification/domain/model/aggregates/verification-challenge.aggregate.js';
import { ChallengeId } from '../../../../src/verification/domain/model/valueobjects/challenge-id.value-object.js';
import { ChallengeStanding } from '../../../../src/verification/domain/model/valueobjects/challenge-standing.value-object.js';
import { Purpose } from '../../../../src/verification/domain/model/valueobjects/purpose.value-object.js';
import { ValidityWindow } from '../../../../src/verification/domain/model/valueobjects/validity-window.value-object.js';
import { PersonId } from '../../../../src/shared/domain/model/valueobjects/person-id.value-object.js';
import { ChallengeElapsedError } from '../../../../src/verification/domain/exceptions/challenge-elapsed.error.js';
import { ChallengeExpiredEvent } from '../../../../src/verification/domain/model/events/challenge-expired.event.js';

function openChallenge(window: ValidityWindow): VerificationChallenge {
  return VerificationChallenge.request(
    ChallengeId.generate(),
    PersonId.of('per-1'),
    Purpose.LOGIN,
    window,
    'hash-1',
  );
}

describe('VerificationChallenge expiry', () => {
  it('marks EXPIRED and raises ChallengeElapsedError when the window has elapsed', () => {
    const elapsedWindow = ValidityWindow.of(
      new Date(Date.now() - 10 * 60_000),
      new Date(Date.now() - 5 * 60_000),
    );
    const elapsed = openChallenge(elapsedWindow);
    elapsed.pullDomainEvents();

    expect(() => elapsed.answer(true, new Date())).toThrow(ChallengeElapsedError);
    expect(elapsed.standing).toBe(ChallengeStanding.EXPIRED);
    expect(elapsed.pullDomainEvents()[0]).toBeInstanceOf(ChallengeExpiredEvent);
  });

  it('keeps a fresh challenge OPEN and usable', () => {
    const fresh = openChallenge(ValidityWindow.fromNow(5));
    expect(fresh.standing).toBe(ChallengeStanding.OPEN);
    expect(fresh.answerChallengeStanding(new Date()).usable).toBe(true);
  });
});
