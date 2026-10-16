import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { SignedContentRef } from "../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";
import { IllegalWalletStateError } from "../../exceptions/illegal-wallet-state.error.js";
import { KeyForgottenEvent } from "../events/key-forgotten.event.js";
import { KeyReconstructedEvent } from "../events/key-reconstructed.event.js";
import { WalletProvisionedEvent } from "../events/wallet-provisioned.event.js";
import { WalletRetiredEvent } from "../events/wallet-retired.event.js";
import { WalletRotatedEvent } from "../events/wallet-rotated.event.js";
import { WalletSuspendedEvent } from "../events/wallet-suspended.event.js";
import { DerivationPosition } from "../valueobjects/derivation-position.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";
import { WalletStanding } from "../valueobjects/wallet-standing.value-object.js";

/**
 * Capability to have exactly one content transiently open for signing.
 * Never holds a secret; the key exists in memory only, during signing.
 */
export interface Signable {
  reconstructForSigning(contentRef: SignedContentRef): void;
  forget(): void;
}

/** Capability adminship: rotate, suspend and retire. */
export interface CustodyStandable {
  rotate(newPosition: DerivationPosition): UserWallet;
  suspend(reason: string): void;
  retire(): void;
}

/**
 * UserWallet aggregate: one person's signing capability. The transient-use
 * pair (`reconstructForSigning`/`forget`) lives inside the aggregate so the
 * open-for-one invariant is atomic. `ROTATED` and `RETIRED` are terminal
 * for the rotated capability; signer ≠ payer (R6, no Relay integration).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class UserWallet extends AggregateRoot implements Signable, CustodyStandable {
  private constructor(
    private readonly _id: UserWalletId,
    private readonly _personId: PersonId,
    private _position: DerivationPosition,
    private _standing: WalletStanding,
    private _openFor: SignedContentRef | null,
  ) { super(); }

  static provision(
    id: UserWalletId,
    personId: PersonId,
    position: DerivationPosition,
  ): UserWallet {
    const w = new UserWallet(id, personId, position, WalletStanding.PROVISIONED, null);
    w.registerEvent(new WalletProvisionedEvent(id, personId, position));
    return w;
  }

  static rehydrate(
    id: UserWalletId,
    personId: PersonId,
    position: DerivationPosition,
    standing: WalletStanding,
    openFor: SignedContentRef | null,
  ): UserWallet {
    return new UserWallet(id, personId, position, standing, openFor);
  }

  reconstructForSigning(contentRef: SignedContentRef): void {
    if (this._standing === WalletStanding.SUSPENDED)
      throw new IllegalWalletStateError('SigningNotAllowed_Suspended');
    if (this._standing === WalletStanding.RETIRED)
      throw new IllegalWalletStateError('SigningNotAllowed_Retired');
    if (this._standing !== WalletStanding.PROVISIONED)
      throw new IllegalWalletStateError('capability not provisioned');
    if (this._openFor !== null)
      throw new IllegalWalletStateError('ReconstructionAlreadyOpen');
    this._standing = WalletStanding.SIGNING_OPEN;
    this._openFor = contentRef;
    this.registerEvent(new KeyReconstructedEvent(this._id, contentRef));
  }

  forget(): void {
    if (this._standing !== WalletStanding.SIGNING_OPEN)
      throw new IllegalWalletStateError('nothing open to forget');
    const ref = this._openFor!;
    this._openFor = null;
    this._standing = WalletStanding.PROVISIONED;
    this.registerEvent(new KeyForgottenEvent(this._id, ref));
  }

  /**
   * Rotates to a fresh position: this capability becomes ROTATED (its
   * position never signs again) and the successor is born PROVISIONED. The
   * service saves both in the same unit of work.
   * @param newPosition Fresh derivation position, never used before.
   */
  rotate(newPosition: DerivationPosition): UserWallet {
    if (this._standing !== WalletStanding.PROVISIONED)
      throw new IllegalWalletStateError('RotationNotAllowed');
    if (this._openFor !== null)
      throw new IllegalWalletStateError('ReconstructionOpen');
    this._standing = WalletStanding.ROTATED;
    this.registerEvent(new WalletRotatedEvent(this._id, this._position, newPosition));
    return UserWallet.provision(UserWalletId.generate(), this._personId, newPosition);
  }

  suspend(reason: string): void {
    if (this._standing !== WalletStanding.PROVISIONED)
      throw new IllegalWalletStateError('suspend only from PROVISIONED');
    if (!reason?.trim()) throw new IllegalWalletStateError('reason required');
    this._standing = WalletStanding.SUSPENDED;
    this.registerEvent(new WalletSuspendedEvent(this._id, reason));
  }

  retire(): void {
    if (this._standing === WalletStanding.RETIRED)
      throw new IllegalWalletStateError('WalletConcluded');
    this._standing = WalletStanding.RETIRED;
    this._openFor = null;
    this.registerEvent(new WalletRetiredEvent(this._id, this._personId));
  }

  answerCapability(): { maySign: boolean; walletId: string; position: number } {
    return { maySign: this._standing === WalletStanding.PROVISIONED, walletId: this._id.value, position: this._position.value };
  }

  get id(): UserWalletId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get position(): DerivationPosition { return this._position; }
  get standing(): WalletStanding { return this._standing; }
  get openFor(): SignedContentRef | null { return this._openFor; }
}
