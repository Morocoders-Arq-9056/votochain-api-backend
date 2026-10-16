import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { AttemptConcludedError } from "../../exceptions/attempt-concluded.error.js";
import { ReferenceEndedError } from "../../exceptions/reference-ended.error.js";
import { FaceComparisonRequestedEvent } from "../events/face-comparison-requested.event.js";
import { IdentityVerificationFailedEvent } from "../events/identity-verification-failed.event.js";
import { IdentityVerifiedEvent } from "../events/identity-verified.event.js";
import { LivenessChallengeStartedEvent } from "../events/liveness-challenge-started.event.js";
import { LivenessFailedEvent } from "../events/liveness-failed.event.js";
import { LivenessPassedEvent } from "../events/liveness-passed.event.js";
import { VerificationAttemptExpiredEvent } from "../events/verification-attempt-expired.event.js";
import { AttemptStanding } from "../valueobjects/attempt-standing.value-object.js";
import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";
import { FailureReason } from "../valueobjects/failure-reason.value-object.js";
import { FreshnessWindow } from "../valueobjects/freshness-window.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { VerificationAttemptId } from "../valueobjects/verification-attempt-id.value-object.js";

/** Lifecycle contract: liveness first, then comparison, then a frozen verdict. */
export interface AttemptStandable {
  completeLiveness(present: boolean): void;
  requestComparison(profileLive: boolean): void;
  recordVerdict(match: boolean, now: Date): void;
  expire(reason: FailureReason): void;
}

/**
 * VerificationAttempt aggregate: one presence-proof + comparison interaction;
 * born and dies in minutes. Liveness must pass before any comparison; the
 * binary verdict is frozen and stamped with a freshness window.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class VerificationAttempt extends AggregateRoot implements AttemptStandable {
  private constructor(
    private readonly _id: VerificationAttemptId,
    private readonly _personId: PersonId,
    private readonly _profileId: BiometricProfileId,
    private _standing: AttemptStanding,
    private _freshness: FreshnessWindow,
    private _failure: FailureReason | null = null,
  ) { super(); }

  static start(input: {
    id: VerificationAttemptId; personId: PersonId; profileId: BiometricProfileId; freshness: FreshnessWindow;
  }): VerificationAttempt {
    const a = new VerificationAttempt(
      input.id, input.personId, input.profileId, AttemptStanding.CHALLENGE_OPEN, input.freshness,
    );
    a.registerEvent(new LivenessChallengeStartedEvent(a._id, a._personId));
    return a;
  }

  static rehydrate(input: {
    id: VerificationAttemptId; personId: PersonId; profileId: BiometricProfileId;
    standing: AttemptStanding; freshness: FreshnessWindow; failure: FailureReason | null;
  }): VerificationAttempt {
    return new VerificationAttempt(
      input.id, input.personId, input.profileId, input.standing, input.freshness, input.failure,
    );
  }

  completeLiveness(present: boolean): void {
    this.assertStanding(AttemptStanding.CHALLENGE_OPEN);
    if (present) {
      this._standing = AttemptStanding.LIVENESS_PASSED;
      this.registerEvent(new LivenessPassedEvent(this._id));
    } else {
      this._standing = AttemptStanding.LIVENESS_FAILED;
      this._failure = FailureReason.LIVENESS_NOT_OBSERVED;
      this.registerEvent(new LivenessFailedEvent(this._id, FailureReason.LIVENESS_NOT_OBSERVED));
    }
  }

  requestComparison(profileLive: boolean): void {
    this.assertStanding(AttemptStanding.LIVENESS_PASSED);
    if (!profileLive) throw new ReferenceEndedError('reference revoked');
    this._standing = AttemptStanding.COMPARISON_REQUESTED;
    this.registerEvent(new FaceComparisonRequestedEvent(this._id, this._profileId));
  }

  recordVerdict(match: boolean, now: Date): void {
    this.assertStanding(AttemptStanding.COMPARISON_REQUESTED);
    if (match) {
      this._standing = AttemptStanding.VERIFIED;
      this._freshness = this._freshness.stamp(now);
      this.registerEvent(new IdentityVerifiedEvent(this._id, this._personId, this._freshness));
    } else {
      this._standing = AttemptStanding.NOT_VERIFIED;
      this._failure = FailureReason.NO_MATCH;
      this.registerEvent(new IdentityVerificationFailedEvent(this._id, this._personId, FailureReason.NO_MATCH));
    }
  }

  expire(reason: FailureReason): void {
    const terminal: AttemptStanding[] = [
      AttemptStanding.VERIFIED,
      AttemptStanding.NOT_VERIFIED,
      AttemptStanding.LIVENESS_FAILED,
      AttemptStanding.EXPIRED,
    ];
    if (terminal.includes(this._standing)) return;
    this._standing = AttemptStanding.EXPIRED;
    this._failure = reason;
    this.registerEvent(new VerificationAttemptExpiredEvent(this._id, reason));
  }

  answerStanding(now: Date): { verifiedNow: boolean; reason: FailureReason | null } {
    const fresh = this._standing === AttemptStanding.VERIFIED && !this._freshness.isElapsed(now);
    return { verifiedNow: fresh, reason: fresh ? null : (this._failure ?? FailureReason.ATTEMPT_EXPIRED) };
  }

  private assertStanding(s: AttemptStanding): void {
    if (this._standing !== s) throw new AttemptConcludedError(`expected ${s}, was ${this._standing}`);
  }

  get id(): VerificationAttemptId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get profileId(): BiometricProfileId { return this._profileId; }
  get standing(): AttemptStanding { return this._standing; }
  get freshness(): FreshnessWindow { return this._freshness; }
  get failure(): FailureReason | null { return this._failure; }
}
