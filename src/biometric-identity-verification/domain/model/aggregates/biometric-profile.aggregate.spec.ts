import { BiometricProfile } from './biometric-profile.aggregate.js';
import { BiometricProfileId } from '../valueobjects/biometric-profile-id.value-object.js';
import { PersonId } from '../valueobjects/person-id.value-object.js';
import { ProfileStanding } from '../valueobjects/profile-standing.value-object.js';
import { BiometricEnrolledEvent } from '../events/biometric-enrolled.event.js';
import { BiometricProfileRevokedEvent } from '../events/biometric-profile-revoked.event.js';
import { AttemptConcludedError } from '../../exceptions/attempt-concluded.error.js';

function enrolledProfile(): BiometricProfile {
  const p = BiometricProfile.enroll({ id: BiometricProfileId.generate(), personId: PersonId.generate() });
  p.pullDomainEvents();
  return p;
}

describe('BiometricProfile aggregate', () => {
  it('enrolls ENROLLED emitting BiometricEnrolledEvent with a live reference', () => {
    const personId = PersonId.generate();
    const p = BiometricProfile.enroll({ id: BiometricProfileId.generate(), personId });

    expect(p.standing).toBe(ProfileStanding.ENROLLED);
    expect(p.personId.equals(personId)).toBe(true);
    expect(p.answerReferenceStanding()).toEqual({ live: true });

    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BiometricEnrolledEvent);
  });

  it('revokes to REVOKED emitting BiometricProfileRevokedEvent', () => {
    const p = enrolledProfile();

    p.revoke();

    expect(p.standing).toBe(ProfileStanding.REVOKED);
    expect(p.answerReferenceStanding()).toEqual({ live: false });

    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BiometricProfileRevokedEvent);
  });

  it('refuses a second revoke: REVOKED is terminal', () => {
    const p = enrolledProfile();
    p.revoke();
    p.pullDomainEvents();

    expect(() => p.revoke()).toThrow(AttemptConcludedError);
  });

  it('rehydrates stored state without raising events', () => {
    const id = BiometricProfileId.generate();
    const personId = PersonId.generate();
    const p = BiometricProfile.rehydrate({ id, personId, standing: ProfileStanding.REVOKED });

    expect(p.id.equals(id)).toBe(true);
    expect(p.personId.equals(personId)).toBe(true);
    expect(p.standing).toBe(ProfileStanding.REVOKED);
    expect(p.pullDomainEvents()).toHaveLength(0);
  });
});
