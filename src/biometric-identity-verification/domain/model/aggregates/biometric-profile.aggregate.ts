import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { AttemptConcludedError } from "../../exceptions/attempt-concluded.error.js";
import { BiometricEnrolledEvent } from "../events/biometric-enrolled.event.js";
import { BiometricProfileRevokedEvent } from "../events/biometric-profile-revoked.event.js";
import { BiometricProfileId } from "../valueobjects/biometric-profile-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { ProfileStanding } from "../valueobjects/profile-standing.value-object.js";

/** Lifecycle contract: enroll once; revoke is terminal. */
export interface Enrollable {
  enroll(): void;
  revoke(): void;
}

/**
 * BiometricProfile aggregate: a person's lasting reference, once per person.
 * `ENROLLED → REVOKED` terminal; a re-enrollment is a fresh identity. Never
 * holds raw images — only what matching needs.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class BiometricProfile extends AggregateRoot implements Enrollable {
  private constructor(
    private readonly _id: BiometricProfileId,
    private readonly _personId: PersonId,
    private _standing: ProfileStanding,
  ) { super(); }

  static enroll(input: { id: BiometricProfileId; personId: PersonId }): BiometricProfile {
    const p = new BiometricProfile(input.id, input.personId, ProfileStanding.ENROLLED);
    p.registerEvent(new BiometricEnrolledEvent(p._id, p._personId));
    return p;
  }

  static rehydrate(input: {
    id: BiometricProfileId; personId: PersonId; standing: ProfileStanding;
  }): BiometricProfile {
    return new BiometricProfile(input.id, input.personId, input.standing);
  }

  enroll(): void {
    if (this._standing === ProfileStanding.ENROLLED)
      throw new AttemptConcludedError('already enrolled');
  }

  revoke(): void {
    if (this._standing !== ProfileStanding.ENROLLED)
      throw new AttemptConcludedError('already revoked');
    this._standing = ProfileStanding.REVOKED;
    this.registerEvent(new BiometricProfileRevokedEvent(this._id, this._personId));
  }

  answerReferenceStanding(): { live: boolean } {
    return { live: this._standing === ProfileStanding.ENROLLED };
  }

  get id(): BiometricProfileId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get standing(): ProfileStanding { return this._standing; }
}
