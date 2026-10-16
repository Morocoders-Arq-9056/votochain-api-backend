import { SignedContentRef } from '../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js';
import { UserWallet } from './user-wallet.aggregate.js';
import { DerivationPosition } from '../valueobjects/derivation-position.value-object.js';
import { PersonId } from '../valueobjects/person-id.value-object.js';
import { UserWalletId } from '../valueobjects/user-wallet-id.value-object.js';
import { WalletStanding } from '../valueobjects/wallet-standing.value-object.js';
import { KeyForgottenEvent } from '../events/key-forgotten.event.js';
import { KeyReconstructedEvent } from '../events/key-reconstructed.event.js';
import { WalletProvisionedEvent } from '../events/wallet-provisioned.event.js';
import { WalletRetiredEvent } from '../events/wallet-retired.event.js';
import { WalletRotatedEvent } from '../events/wallet-rotated.event.js';
import { WalletSuspendedEvent } from '../events/wallet-suspended.event.js';
import { IllegalWalletStateError } from '../../exceptions/illegal-wallet-state.error.js';

function provisioned(): UserWallet {
  const w = UserWallet.provision(
    UserWalletId.generate(),
    PersonId.generate(),
    DerivationPosition.of(0),
  );
  w.pullDomainEvents();
  return w;
}

function content(): SignedContentRef {
  return SignedContentRef.of('vote:prop-1:0xvoter:yes:nonce-1');
}

describe('UserWallet aggregate', () => {
  it('provisions PROVISIONED emitting WalletProvisionedEvent, nothing signable at rest', () => {
    const w = UserWallet.provision(
      UserWalletId.generate(),
      PersonId.generate(),
      DerivationPosition.of(0),
    );

    expect(w.standing).toBe(WalletStanding.PROVISIONED);
    expect(w.openFor).toBeNull();
    expect(w.answerCapability().maySign).toBe(true);

    const events = w.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(WalletProvisionedEvent);
  });

  it('reconstructs for exactly one content then forgets back to PROVISIONED', () => {
    const w = provisioned();

    w.reconstructForSigning(content());

    expect(w.standing).toBe(WalletStanding.SIGNING_OPEN);
    expect(w.openFor?.equals(content())).toBe(true);

    w.forget();

    expect(w.standing).toBe(WalletStanding.PROVISIONED);
    expect(w.openFor).toBeNull();

    const events = w.pullDomainEvents();
    expect(events.map((x) => x.constructor)).toEqual([KeyReconstructedEvent, KeyForgottenEvent]);
  });

  it('refuses a second concurrent reconstruction', () => {
    const w = provisioned();
    w.reconstructForSigning(content());

    expect(() => w.reconstructForSigning(SignedContentRef.of('vote:other')))
      .toThrow(new IllegalWalletStateError('ReconstructionAlreadyOpen').constructor);
  });

  it('refuses to forget when nothing is open', () => {
    const w = provisioned();

    expect(() => w.forget()).toThrow(IllegalWalletStateError);
  });

  it('rotates to a fresh position: old ROTATED, successor PROVISIONED', () => {
    const w = provisioned();

    const successor = w.rotate(DerivationPosition.of(1));

    expect(w.standing).toBe(WalletStanding.ROTATED);
    expect(successor.standing).toBe(WalletStanding.PROVISIONED);
    expect(successor.position.value).toBe(1);
    expect(successor.personId.equals(w.personId)).toBe(true);

    const events = w.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(WalletRotatedEvent);
    expect(successor.pullDomainEvents()[0]).toBeInstanceOf(WalletProvisionedEvent);
  });

  it('refuses rotation outside PROVISIONED and refuses signing once ROTATED', () => {
    const w = provisioned();
    w.rotate(DerivationPosition.of(1));

    expect(() => w.rotate(DerivationPosition.of(2))).toThrow(IllegalWalletStateError);
    expect(() => w.reconstructForSigning(content())).toThrow(IllegalWalletStateError);
  });

  it('suspends only from PROVISIONED and never signs while suspended', () => {
    const w = provisioned();
    w.suspend('key compromise suspected');

    expect(w.standing).toBe(WalletStanding.SUSPENDED);
    expect(w.answerCapability().maySign).toBe(false);
    expect(w.pullDomainEvents()[0]).toBeInstanceOf(WalletSuspendedEvent);
    expect(() => w.reconstructForSigning(content())).toThrow(IllegalWalletStateError);
  });

  it('retires terminally, closable, and never signs again', () => {
    const w = provisioned();
    w.retire();

    expect(w.standing).toBe(WalletStanding.RETIRED);
    expect(w.answerCapability().maySign).toBe(false);
    expect(w.pullDomainEvents()[0]).toBeInstanceOf(WalletRetiredEvent);
    expect(() => w.retire()).toThrow(IllegalWalletStateError);
    expect(() => w.reconstructForSigning(content())).toThrow(IllegalWalletStateError);
  });
});
