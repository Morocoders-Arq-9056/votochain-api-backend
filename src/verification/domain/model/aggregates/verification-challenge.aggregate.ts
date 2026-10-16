import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { AttemptCount } from "../valueobjects/attempt-count.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { ChallengeStandable } from "../valueobjects/challenge-standable.value-object.js";
import { ChallengeStanding } from "../valueobjects/challenge-standing.value-object.js";
import { InvalidationReason, attemptsExhausted, superseded } from "../valueobjects/invalidation-reason.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";
import { ValidityWindow } from "../valueobjects/validity-window.value-object.js";
import { ChallengeRequestedEvent } from "../events/challenge-requested.event.js";
import { ChallengeConfirmedEvent } from "../events/challenge-confirmed.event.js";
import { ChallengeAttemptFailedEvent } from "../events/challenge-attempt-failed.event.js";
import { ChallengeInvalidatedEvent } from "../events/challenge-invalidated.event.js";
import { ChallengeExpiredEvent } from "../events/challenge-expired.event.js";
import { AlreadyAnsweredError } from "../../exceptions/already-answered.error.js";
import { ChallengeElapsedError } from "../../exceptions/challenge-elapsed.error.js";

export class VerificationChallenge extends AggregateRoot implements ChallengeStandable {
  private constructor(
    private readonly _id: ChallengeId,
    private readonly _personId: PersonId,
    private readonly _purpose: Purpose,
    private _standing: ChallengeStanding,
    private _attempts: AttemptCount,
    private readonly _window: ValidityWindow,
    private _codeHash: string,
    private _invalidationReason: InvalidationReason | null,
  ) { super(); }

  static request(id: ChallengeId, p: PersonId, purpose: Purpose, win: ValidityWindow, codeHash: string): VerificationChallenge {
    const c = new VerificationChallenge(id, p, purpose, ChallengeStanding.OPEN, AttemptCount.fresh(5), win, codeHash, null);
    c.registerEvent(new ChallengeRequestedEvent(id, p, purpose, win));
    return c;
  }
  static rehydrate(i: { id: ChallengeId; personId: PersonId; purpose: Purpose; standing: ChallengeStanding; attempts: AttemptCount; window: ValidityWindow; codeHash: string; reason: InvalidationReason | null }): VerificationChallenge {
    return new VerificationChallenge(i.id, i.personId, i.purpose, i.standing, i.attempts, i.window, i.codeHash, i.reason);
  }

  answer(holds: boolean, now: Date): void {
    if (this._standing !== ChallengeStanding.OPEN) throw new AlreadyAnsweredError('challenge already answered');
    if (this._window.isElapsed(now)) {
      this._standing = ChallengeStanding.EXPIRED;
      this.registerEvent(new ChallengeExpiredEvent(this._id, this._personId, this._purpose));
      throw new ChallengeElapsedError('validity window elapsed');
    }
    if (holds) { this._standing = ChallengeStanding.CONFIRMED; this.registerEvent(new ChallengeConfirmedEvent(this._id, this._personId, this._purpose)); return; }
    this._attempts = this._attempts.counted();
    this.registerEvent(new ChallengeAttemptFailedEvent(this._id, this._personId, this._purpose, this._attempts.remaining()));
    if (this._attempts.isExhausted()) {
      this._standing = ChallengeStanding.INVALIDATED;
      this._invalidationReason = attemptsExhausted();
      this.registerEvent(new ChallengeInvalidatedEvent(this._id, this._personId, this._purpose, this._invalidationReason));
    }
  }
  supersede(): void {
    if (this._standing !== ChallengeStanding.OPEN) return;
    this._standing = ChallengeStanding.INVALIDATED;
    this._invalidationReason = superseded();
    this.registerEvent(new ChallengeInvalidatedEvent(this._id, this._personId, this._purpose, this._invalidationReason));
  }
  expire(now: Date): void {
    if (this._standing === ChallengeStanding.OPEN && this._window.isElapsed(now)) {
      this._standing = ChallengeStanding.EXPIRED; this.registerEvent(new ChallengeExpiredEvent(this._id, this._personId, this._purpose));
    }
  }

  answerChallengeStanding(now: Date): { usable: boolean; remaining: number } {
    const usable = this._standing === ChallengeStanding.OPEN && !this._window.isElapsed(now) && !this._attempts.isExhausted();
    return { usable, remaining: this._attempts.remaining() };
  }
  get id(): ChallengeId { return this._id; } get standing(): ChallengeStanding { return this._standing; }
  get codeHash(): string { return this._codeHash; } get personId(): PersonId { return this._personId; }
  get purpose(): Purpose { return this._purpose; } get attempts(): AttemptCount { return this._attempts; }
  get window(): ValidityWindow { return this._window; }
  get invalidationReason(): InvalidationReason | null { return this._invalidationReason; }
}