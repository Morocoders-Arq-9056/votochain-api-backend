import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
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
import { SystemRoleAssignment } from "../entities/system-role-assignment.entity.js";
import { AccessStandable } from "../valueobjects/access-standable.value-object.js";
import { AccessStanding } from "../valueobjects/access-standing.value-object.js";
import { ContactAddress } from "../valueobjects/contact-address.value-object.js";
import { OutsideProverRef } from "../valueobjects/outside-prover-ref.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
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
export class User extends AggregateRoot implements AccessStandable {
  private constructor(
    private readonly _id: UserId,
    private readonly _personId: PersonId,
    private _standing: AccessStanding,
    private _session: SessionStanding,
    private _contact: ContactAddress,
    private _assignments: SystemRoleAssignment[],
    private _outsideProver: OutsideProverRef | null,
  ) { super(); }

  static signUp(input: { personId: PersonId; contact: ContactAddress }): User {
    const user = new User(UserId.generate(), input.personId, AccessStanding.REGISTERED, SessionStanding.CLOSED,
      input.contact, [SystemRoleAssignment.grant(SystemRole.USER)], null);
    user.registerEvent(new UserSignedUpEvent(user._id, user._personId, user._contact));
    return user;
  }

  static rehydrate(input: { id: UserId; personId: PersonId; standing: AccessStanding;
    session: SessionStanding; contact: ContactAddress; assignments: SystemRoleAssignment[];
    outsideProver: OutsideProverRef | null }): User {
    return new User(input.id, input.personId, input.standing,
      input.session, input.contact, input.assignments, input.outsideProver);
  }

  protected applyStandingTransition(from: AccessStanding, to: AccessStanding, event: { eventName: string }): void {
    if (this._standing !== from) throw new IllegalUserStateError(`standing ${this._standing} != ${from}`);
    this._standing = to;
    this.registerEvent(event as never);
  }

  private tearDownSession(reason: SignOutReason): void {
    if (this._session !== SessionStanding.OPEN) return;
    this._session = SessionStanding.CLOSED;
    this.registerEvent(new UserSignedOutEvent(this._id, this._personId, reason));
  }

  private proofKinds(): ProofKind[] {
    return [ProofKind.LOCAL, ...(this._outsideProver ? [ProofKind.OUTSIDE] : [])];
  }

  signIn(kind: ProofKind): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._session === SessionStanding.OPEN)
      this.registerEvent(new UserSignedOutEvent(this._id, this._personId, SignOutReason.SUPERSEDED));
    this._session = SessionStanding.OPEN;
    this.registerEvent(new UserSignedInEvent(this._id, this._personId, kind));
  }

  signOut(): void {
    if (this._session !== SessionStanding.OPEN) throw new NoOpenSessionError('no session');
    this.tearDownSession(SignOutReason.ASKED);
  }

  changeSecret(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    this.tearDownSession(SignOutReason.PROOF_CHANGED);
    this.registerEvent(new SecretChangedEvent(this._id, this._personId));
  }

  changeEmail(newEmail: string): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    const oldEmail = this._contact.email;
    this._contact = this._contact.change(newEmail);
    this.registerEvent(new EmailChangedEvent(this._id, this._personId, oldEmail, newEmail));
  }

  verifyEmail(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (this._contact.verified) throw new IllegalUserStateError('already verified');
    this._contact = this._contact.verify();
    if (this._standing === AccessStanding.REGISTERED) this._standing = AccessStanding.ACTIVE;
    this.registerEvent(new EmailVerifiedEvent(this._id, this._personId, this._contact.email));
  }

  linkOutsideIdentity(prover: OutsideProverRef): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._outsideProver) throw new OutsideProofAlreadyLinkedError('outside proof already linked');
    this._outsideProver = prover;
    this.registerEvent(new OutsideIdentityLinkedEvent(this._id, this._personId, prover));
  }

  unlinkOutsideIdentity(prover: OutsideProverRef): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (!this._outsideProver) throw new IllegalUserStateError('no outside proof linked');
    if (this.proofKinds().length === 1) throw new LastProofRefusedError('last proof refused');
    this._outsideProver = null;
    this.registerEvent(new OutsideIdentityUnlinkedEvent(this._id, this._personId, prover));
  }

  grantSystemRole(role: SystemRole): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (this.hasRole(role)) throw new RoleAlreadyHeldError(`role already held: ${role}`);
    this._assignments = [...this._assignments, SystemRoleAssignment.grant(role)];
    this.registerEvent(new SystemRoleGrantedEvent(this._id, this._personId, role));
  }

  revokeSystemRole(role: SystemRole): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    if (!this.hasRole(role)) throw new RoleNotHeldError(`role not held: ${role}`);
    if (role === SystemRole.ADMIN && this._assignments.filter((a) => a.role === SystemRole.ADMIN).length === 1)
      throw new LastAdminRefusedError('last admin refused');
    this._assignments = this._assignments.filter((a) => a.role !== role);
    this.registerEvent(new SystemRoleRevokedEvent(this._id, this._personId, role));
  }

  hasRole(role: SystemRole): boolean {
    return this._assignments.some((a) => a.role === role);
  }

  get roleAssignments(): SystemRoleAssignment[] { return [...this._assignments]; }
  get id(): UserId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get standing(): AccessStanding { return this._standing; }
  get session(): SessionStanding { return this._session; }
  get contact(): ContactAddress { return this._contact; }
  get outsideProver(): OutsideProverRef | null { return this._outsideProver; }

  suspend(reason: string): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new IllegalUserStateError('already suspended');
    this.applyStandingTransition(this._standing, AccessStanding.SUSPENDED, new AccessSuspendedEvent(this._id, this._personId, reason));
    this.tearDownSession(SignOutReason.SUSPENDED);
  }

  restore(): void {
    this.applyStandingTransition(AccessStanding.SUSPENDED, AccessStanding.ACTIVE, new AccessRestoredEvent(this._id, this._personId));
  }

  answerAccessStanding(): { mayAct: boolean; roles: SystemRole[]; sessionOpen: boolean } {
    return {
      mayAct: this._standing === AccessStanding.ACTIVE,
      roles: this._assignments.map((a) => a.role),
      sessionOpen: this._session === SessionStanding.OPEN,
    };
  }
}