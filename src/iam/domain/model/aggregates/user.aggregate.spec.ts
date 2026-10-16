import { User } from './user.aggregate.js';
import { ContactAddress } from '../valueobjects/contact-address.value-object.js';
import { AccessStanding } from '../valueobjects/access-standing.value-object.js';
import { SessionStanding } from '../valueobjects/session-standing.value-object.js';
import { ProofKind } from '../valueobjects/proof-kind.value-object.js';
import { SignOutReason } from '../valueobjects/sign-out-reason.value-object.js';
import { SystemRole } from '../valueobjects/system-role.value-object.js';
import { OutsideProverRef } from '../valueobjects/outside-prover-ref.value-object.js';
import { UserSignedUpEvent } from '../events/user-signed-up.event.js';
import { UserSignedInEvent } from '../events/user-signed-in.event.js';
import { UserSignedOutEvent } from '../events/user-signed-out.event.js';
import { OutsideIdentityUnlinkedEvent } from '../events/outside-identity-unlinked.event.js';
import { IllegalUserStateError } from '../../exceptions/illegal-user-state.error.js';
import { NoOpenSessionError } from '../../exceptions/no-open-session.error.js';
import { LastAdminRefusedError } from '../../exceptions/last-admin-refused.error.js';
import { SuspendedRefusedError } from '../../exceptions/suspended-refused.error.js';

function activeUser(): User {
  const user = User.signUp({ contact: ContactAddress.create('ada@votachain.dev') });
  user.pullDomainEvents();
  user.verifyEmail();
  user.pullDomainEvents();
  return user;
}

describe('User aggregate (signup slice)', () => {
  it('signs up REGISTERED with a closed session and the USER role', () => {
    const user = User.signUp({ contact: ContactAddress.create('ada@votachain.dev') });

    expect(user.standing).toBe(AccessStanding.REGISTERED);
    expect(user.session).toBe(SessionStanding.CLOSED);
    expect(user.contact.email).toBe('ada@votachain.dev');
    expect(user.roles).toEqual([SystemRole.USER]);

    const events = user.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(UserSignedUpEvent);
  });

  it('opens a session on signIn and supersedes it on a second signIn', () => {
    const user = activeUser();

    user.signIn(ProofKind.LOCAL);
    expect(user.session).toBe(SessionStanding.OPEN);
    user.signIn(ProofKind.LOCAL);

    const events = user.pullDomainEvents();
    const signedOut = events.filter((e): e is UserSignedOutEvent => e instanceof UserSignedOutEvent);
    expect(signedOut).toHaveLength(1);
    expect(signedOut[0]?.reason).toBe(SignOutReason.SUPERSEDED);
    expect(events.filter((e) => e instanceof UserSignedInEvent)).toHaveLength(2);
  });

  it('closes the session on signOut and refuses a second signOut', () => {
    const user = activeUser();
    user.signIn(ProofKind.LOCAL);
    user.pullDomainEvents();

    user.signOut();
    expect(user.session).toBe(SessionStanding.CLOSED);
    expect(() => user.signOut()).toThrow(NoOpenSessionError);
  });

  it('suspends an open session and restores to ACTIVE', () => {
    const user = activeUser();
    user.signIn(ProofKind.LOCAL);
    user.pullDomainEvents();

    user.suspend('abuse');
    expect(user.standing).toBe(AccessStanding.SUSPENDED);
    expect(user.session).toBe(SessionStanding.CLOSED);

    const events = user.pullDomainEvents();
    const signedOut = events.filter((e): e is UserSignedOutEvent => e instanceof UserSignedOutEvent);
    expect(signedOut).toHaveLength(1);
    expect(signedOut[0]?.reason).toBe(SignOutReason.SUSPENDED);

    user.restore();
    expect(user.standing).toBe(AccessStanding.ACTIVE);
  });

  it('refuses signIn while suspended and revoking the last admin', () => {
    const user = activeUser();
    user.suspend('abuse');
    expect(() => user.signIn(ProofKind.LOCAL)).toThrow(SuspendedRefusedError);

    const admin = activeUser();
    admin.grantSystemRole(SystemRole.ADMIN);
    expect(() => admin.revokeSystemRole(SystemRole.ADMIN)).toThrow(LastAdminRefusedError);
  });

  it('links and unlinks the outside proof, carrying the provider subject', () => {
    const user = activeUser();
    user.pullDomainEvents();
    user.linkOutsideIdentity(OutsideProverRef.of('auth0', 'auth0|abc'));
    expect(user.outsideProver?.externalId).toBe('auth0|abc');
    user.pullDomainEvents();

    user.unlinkOutsideIdentity('auth0');
    expect(user.outsideProver).toBeNull();

    const events = user.pullDomainEvents();
    const unlinked = events.find((e): e is OutsideIdentityUnlinkedEvent => e instanceof OutsideIdentityUnlinkedEvent);
    expect(unlinked?.prover.externalId).toBe('auth0|abc');
  });

  it('refuses to unlink a prover that is not the linked one', () => {
    const user = activeUser();
    user.pullDomainEvents();
    user.linkOutsideIdentity(OutsideProverRef.of('auth0', 'auth0|abc'));

    expect(() => user.unlinkOutsideIdentity('other')).toThrow(IllegalUserStateError);
  });
});
