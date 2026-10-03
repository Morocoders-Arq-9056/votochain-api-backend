import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { IllegalUserStateError } from "../../exceptions/illegal-user-state.error.js";
import { LastAdminRefusedError } from "../../exceptions/last-admin-refused.error.js";
import { LastProofRefusedError } from "../../exceptions/last-proof-refused.error.js";
import { NoOpenSessionError } from "../../exceptions/no-open-session.error.js";
import { OutsideProofAlreadyLinkedError } from "../../exceptions/outside-proof-already-linked.error.js";
import { RoleAlreadyHeldError } from "../../exceptions/role-already-held.error.js";
import { RoleNotHeldError } from "../../exceptions/role-not-held.error.js";
import { SuspendedRefusedError } from "../../exceptions/suspended-refused.error.js";
import { AccessRestoredEvent } from "../events/access-restored.event.js";
import { AccessSuspendedEvent } from "../events/access-suspended.event.js";
import { EmailChangedEvent } from "../events/email-changed.event.js";
import { EmailVerifiedEvent } from "../events/email-verified.event.js";
import { OutsideIdentityLinkedEvent } from "../events/outside-identity-linked.event.js";
import { OutsideIdentityUnlinkedEvent } from "../events/outside-identity-unlinked.event.js";
import { SecretChangedEvent } from "../events/secret-changed.event.js";
import { SystemRoleGrantedEvent } from "../events/system-role-granted.event.js";
import { SystemRoleRevokedEvent } from "../events/system-role-revoked.event.js";
import { UserSignedInEvent } from "../events/user-signed-in.event.js";
import { UserSignedOutEvent } from "../events/user-signed-out.event.js";
import { UserSignedUpEvent } from "../events/user-signed-up.event.js";
import { AccessStandable } from "../valueobjects/access-standable.value-object.js";
import { AccessStandingAnswer } from "../valueobjects/access-standing-answer.value-object.js";
import { AccessStanding } from "../valueobjects/access-standing.value-object.js";
import { ContactAddress } from "../valueobjects/contact-address.value-object.js";
import { OutsideProverRef } from "../valueobjects/outside-prover-ref.value-object.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ProofKind } from "../valueobjects/proof-kind.value-object.js";
import { SessionStanding } from "../valueobjects/session-standing.value-object.js";
import { SignOutReason } from "../valueobjects/sign-out-reason.value-object.js";
import { SystemRole } from "../valueobjects/system-role.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

/**
 * Aggregate root representing a user in the system.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
/**
 * Aggregate root representing one person's technical identity.
 *
 * Single consistency boundary for standing, session (at most one open),
 * contact address, system roles and the linked outside proof. Membership,
 * community and physical identity are referenced by identity only.
 * Session supersede and standing transitions are atomic by construction.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-10
 */
export class User extends AggregateRoot implements AccessStandable {
  /**
   * Creates the aggregate; use {@link User.signUp} for new identities
   * or {@link User.rehydrate} to rebuild stored state without events.
   */
  private constructor(
    private readonly _id: UserId,
    private readonly _personId: PersonId,
    private _standing: AccessStanding,
    private _session: SessionStanding,
    private _contact: ContactAddress,
    private _roles: SystemRole[],
    private _outsideProver: OutsideProverRef | null,
  ) { super(); }

  /**
   * Creates a brand-new REGISTERED identity with a closed session.
   * Mints UserId + PersonId and raises UserSignedUpEvent.
   * @param input Carries the initial unverified contact address.
   */
  static signUp(input: { contact: ContactAddress }): User {
    const user = new User(UserId.generate(), PersonId.generate(), AccessStanding.REGISTERED, SessionStanding.CLOSED,
      input.contact, [SystemRole.USER], null);
    user.registerEvent(new UserSignedUpEvent(user._id, user._personId, user._contact));
    return user;
  }

  /**
   * Rebuilds a stored identity without raising events or assuming status.
   */
  static rehydrate(input: { id: UserId; personId: PersonId; standing: AccessStanding;
    session: SessionStanding; contact: ContactAddress; roles: SystemRole[];
    outsideProver: OutsideProverRef | null }): User {
    return new User(input.id, input.personId, input.standing,
      input.session, input.contact, [...input.roles], input.outsideProver);
  }

  /**
   * Validates a standing transition, mutates standing and registers the event.
   * Shared guard for suspend/restore; throws on illegal origin state.
   */
  private applyStandingTransition(from: AccessStanding, to: AccessStanding, event: DomainEvent): void {
    if (this._standing !== from) throw new IllegalUserStateError(`standing ${this._standing} != ${from}`);
    this._standing = to;
    this.registerEvent(event);
  }

  /**
   * Skeleton closing the open session with the given reason; no-op when closed.
   * Invoked by signOut/suspend/changeSecret.
   */
  private tearDownSession(reason: SignOutReason): void {
    if (this._session !== SessionStanding.OPEN) return;
    this._session = SessionStanding.CLOSED;
    this.registerEvent(new UserSignedOutEvent(this._id, this._personId, reason));
  }

  /**
   * Lists the ways to prove currently held: always LOCAL plus OUTSIDE when linked.
   */
  private proofKinds(): ProofKind[] {
    return [ProofKind.LOCAL, ...(this._outsideProver ? [ProofKind.OUTSIDE] : [])];
  }

  /**
   * Proves the user in: requires ACTIVE, supersedes any open session
   * (SUPERSEDED close + new sign-in in the same transition) and records the kind.
   * @param kind Whether the observed proof was LOCAL or OUTSIDE.
   */
  signIn(kind: ProofKind): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._session === SessionStanding.OPEN)
      this.registerEvent(new UserSignedOutEvent(this._id, this._personId, SignOutReason.SUPERSEDED));
    this._session = SessionStanding.OPEN;
    this.registerEvent(new UserSignedInEvent(this._id, this._personId, kind));
  }

  /**
   * Closes the open session with reason ASKED; throws when none is open.
   */
  signOut(): void {
    if (this._session !== SessionStanding.OPEN) throw new NoOpenSessionError('no session');
    this.tearDownSession(SignOutReason.ASKED);
  }

  /**
   * Changes the secret and ends the open session (PROOF_CHANGED).
   * Refused while SUSPENDED; acting again requires the new proof.
   */
  changeSecret(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    this.tearDownSession(SignOutReason.PROOF_CHANGED);
    this.registerEvent(new SecretChangedEvent(this._id, this._personId));
  }

  /**
   * Changes the contact address, resetting verified standing until confirmation.
   * Rebuilds from the address so verification always resets, no matter how
   * the caller constructed the contact.
   * @param contact Fresh address held by nobody else.
   */
  changeEmail(contact: ContactAddress): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    const oldEmail = this._contact.email;
    this._contact = ContactAddress.create(contact.email);
    this.registerEvent(new EmailChangedEvent(this._id, this._personId, oldEmail, this._contact.email));
  }

  /**
   * Records the observed email confirmation; REGISTERED becomes ACTIVE.
   * Delivery is executed outside — this only judges standing.
   */
  verifyEmail(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (this._contact.verified) throw new IllegalUserStateError('already verified');
    this._contact = this._contact.verify();
    if (this._standing === AccessStanding.REGISTERED) this._standing = AccessStanding.ACTIVE;
    this.registerEvent(new EmailVerifiedEvent(this._id, this._personId, this._contact.email));
  }

  /**
   * Links the single agreed outside proof to an ACTIVE identity.
   * @param prover Reference to the genuine outside prover (auth0).
   */
  linkOutsideIdentity(prover: OutsideProverRef): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._outsideProver) throw new OutsideProofAlreadyLinkedError('outside proof already linked');
    this._outsideProver = prover;
    this.registerEvent(new OutsideIdentityLinkedEvent(this._id, this._personId, prover));
  }

  /**
   * Unlinks the outside proof; refused when it is the final way to prove.
   */
  unlinkOutsideIdentity(prover: OutsideProverRef): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (!this._outsideProver) throw new IllegalUserStateError('no outside proof linked');
    if (this.proofKinds().length === 1) throw new LastProofRefusedError('last proof refused');
    this._outsideProver = null;
    this.registerEvent(new OutsideIdentityUnlinkedEvent(this._id, this._personId, prover));
  }

  /**
   * Grants a global technical role; refused when already held.
   */
  grantSystemRole(role: SystemRole): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (this.hasRole(role)) throw new RoleAlreadyHeldError(`role already held: ${role}`);
    this._roles = [...this._roles, role];
    this.registerEvent(new SystemRoleGrantedEvent(this._id, this._personId, role));
  }

  /**
   * Revokes a held role; refused when unheld or when it is the final ADMIN.
   * The final steward is a domain invariant, not an overridable policy.
   */
  revokeSystemRole(role: SystemRole): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (!this.hasRole(role)) throw new RoleNotHeldError(`role not held: ${role}`);
    if (role === SystemRole.ADMIN && this._roles.filter((r) => r === SystemRole.ADMIN).length === 1)
      throw new LastAdminRefusedError('last admin refused');
    this._roles = this._roles.filter((r) => r !== role);
    this.registerEvent(new SystemRoleRevokedEvent(this._id, this._personId, role));
  }

  /**
   * Checks whether the identity currently holds the given system role.
   */
  hasRole(role: SystemRole): boolean {
    return this._roles.some((r) => r === role);
  }

  /**
   * Returns a copy of the held system roles.
   */
  get roles(): SystemRole[] { return [...this._roles]; }
  get id(): UserId { return this._id; }
  /** The person this technical identity belongs to (reference only). */
  get personId(): PersonId { return this._personId; }
  /** Where the identity stands: REGISTERED, ACTIVE or SUSPENDED. */
  get standing(): AccessStanding { return this._standing; }
  /** Whether the person is currently proven-in (single open session at most). */
  get session(): SessionStanding { return this._session; }
  /** Recorded contact address plus its verified standing. */
  get contact(): ContactAddress { return this._contact; }
  /** Linked outside prover reference, or null when only the local secret proves. */
  get outsideProver(): OutsideProverRef | null { return this._outsideProver; }

  /**
   * Suspends access with a recorded reason and ends the open session.
   * History stays for scrutiny; restoration is the only way back.
   */
  suspend(reason: string): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new IllegalUserStateError('already suspended');
    this.applyStandingTransition(this._standing, AccessStanding.SUSPENDED, new AccessSuspendedEvent(this._id, this._personId, reason));
    this.tearDownSession(SignOutReason.SUSPENDED);
  }

  /**
   * Restores a SUSPENDED identity to ACTIVE once the cause is resolved.
   */
  restore(): void {
    this.applyStandingTransition(AccessStanding.SUSPENDED, AccessStanding.ACTIVE, new AccessRestoredEvent(this._id, this._personId));
  }

  /**
   * Answers whether the person may act now, with which roles, session open or not.
   * Read-only answering operation owned by the aggregate; mutates nothing.
   */
  answerAccessStanding(): AccessStandingAnswer {
    return new AccessStandingAnswer(
      this._standing === AccessStanding.ACTIVE,
      [...this._roles],
      this._session === SessionStanding.OPEN,
    );
  }
}