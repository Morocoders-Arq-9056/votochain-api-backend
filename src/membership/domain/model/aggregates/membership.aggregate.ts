import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import { IllegalMembershipTransitionError } from "../../exceptions/illegal-membership-transition.error.js";
import { RoleRequiresActiveError } from "../../exceptions/role-requires-active.error.js";
import { TerminationIsTerminalError } from "../../exceptions/termination-is-terminal.error.js";
import { CommunityRoleAssignedEvent } from "../events/community-role-assigned.event.js";
import { DelinquencyClearedEvent } from "../events/delinquency-cleared.event.js";
import { EligibilityJudgedEvent } from "../events/eligibility-judged.event.js";
import { MemberMarkedDelinquentEvent } from "../events/member-marked-delinquent.event.js";
import { MembershipActivatedEvent } from "../events/membership-activated.event.js";
import { MembershipRegisteredEvent } from "../events/membership-registered.event.js";
import { MembershipReinstatedEvent } from "../events/membership-reinstated.event.js";
import { MembershipSuspendedEvent } from "../events/membership-suspended.event.js";
import { MembershipTerminatedEvent } from "../events/membership-terminated.event.js";
import { UnitAssignedEvent } from "../events/unit-assigned.event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { CommunityRole } from "../valueobjects/community-role.value-object.js";
import { EligibilitySnapshot } from "../valueobjects/eligibility-snapshot.value-object.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";
import { MembershipStatus } from "../valueobjects/membership-status.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { Unit } from "../valueobjects/unit.value-object.js";

export { MembershipStatus, parseMembershipStatus } from "../valueobjects/membership-status.value-object.js";
export type { MembershipStatus as MembershipStatusType } from "../valueobjects/membership-status.value-object.js";

/**
 * Standing contract. No skeleton, no template-method: guards differ too much
 * per transition, so only the `assertNotTerminated` helper is shared and each
 * method keeps its own guard plus its own event.
 */
export interface MembershipStandable {
  activate(): void;
  markDelinquent(reason: string): void;
  clearDelinquency(): void;
  suspend(reason: string): void;
  reinstate(): void;
  terminate(reason: string): void;
}

/**
 * Membership aggregate root: exactly one pair (person, community). The roster
 * is a question over standings, not an object: only ACTIVE counts.
 * TERMINATED is terminal. Eligibility snapshots freeze at judgment time.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class Membership extends AggregateRoot implements MembershipStandable {
  /**
   * Creates the aggregate; use {@link Membership.register} for new pairs,
   * {@link Membership.rehydrate} to rebuild stored state, or
   * {@link Membership.ghost} for the absence-answers judgment.
   */
  private constructor(
    private readonly _id: MembershipId,
    private readonly _personId: PersonId,
    private readonly _communityId: CommunityId,
    private _status: MembershipStatus,
    private _role: CommunityRole,
    private _unit: Unit | null,
    private _lastEligibility: EligibilitySnapshot | null,
  ) { super(); }

  /**
   * Registers a brand-new pair. Always REQUESTED with the OWNER role.
   * @param personId Person joining.
   * @param communityId Community joined.
   * @param unit Dwelling unit, when known at registration.
   */
  static register(personId: PersonId, communityId: CommunityId, unit: Unit | null): Membership {
    const membership = new Membership(
      MembershipId.generate(), personId, communityId,
      MembershipStatus.REQUESTED, CommunityRole.owner(), unit, null,
    );
    membership.registerEvent(new MembershipRegisteredEvent(membership._id, personId, communityId));
    return membership;
  }

  /**
   * Rebuilds a stored membership without raising events.
   */
  static rehydrate(input: {
    id: MembershipId; personId: PersonId; communityId: CommunityId;
    status: MembershipStatus; role: CommunityRole; unit: Unit | null;
    lastEligibility: EligibilitySnapshot | null;
  }): Membership {
    return new Membership(
      input.id, input.personId, input.communityId, input.status,
      input.role, input.unit, input.lastEligibility,
    );
  }

  /**
   * Ghost factory for absence: answers NOT_A_MEMBER, never 404, never persists.
   * The minted MembershipId is discarded — only the judged snapshot is consumed.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   */
  static ghost(personId: PersonId, communityId: CommunityId): Membership {
    return new Membership(
      MembershipId.generate(), personId, communityId, MembershipStatus.REQUESTED,
      CommunityRole.owner(), null,
      EligibilitySnapshot.now(personId, communityId, MembershipStatus.REQUESTED).withVerdict(false),
    );
  }

  /** Activates a REQUESTED membership. */
  activate(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.REQUESTED)
      throw new IllegalMembershipTransitionError('activate only from REQUESTED');
    this._status = MembershipStatus.ACTIVE;
    this.registerEvent(new MembershipActivatedEvent(this._id, this._personId, this._communityId));
  }

  /**
   * Assigns the dwelling unit. Never touches standing history.
   * @param unit Dwelling unit.
   */
  assignUnit(unit: Unit): void {
    this.assertNotTerminated();
    if (!unit) throw new IllegalMembershipTransitionError('unit required');
    this._unit = unit;
    this.registerEvent(new UnitAssignedEvent(this._id, unit));
  }

  /**
   * Assigns the community role. Requires ACTIVE; never touches standing history.
   * @param role Community role.
   */
  assignRole(role: CommunityRole): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE)
      throw new RoleRequiresActiveError('role requires ACTIVE');
    if (!role) throw new RoleRequiresActiveError('role required');
    this._role = role;
    this.registerEvent(new CommunityRoleAssignedEvent(this._id, role));
  }

  /**
   * Marks an ACTIVE membership delinquent.
   * @param reason Recorded delinquency reason.
   */
  markDelinquent(reason: string): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE)
      throw new IllegalMembershipTransitionError('delinquency requires ACTIVE');
    if (!reason?.trim()) throw new IllegalMembershipTransitionError('reason required');
    this._status = MembershipStatus.DELINQUENT;
    this.registerEvent(new MemberMarkedDelinquentEvent(this._id, reason));
  }

  /** Clears delinquency back to ACTIVE. */
  clearDelinquency(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.DELINQUENT)
      throw new IllegalMembershipTransitionError('no delinquency to clear');
    this._status = MembershipStatus.ACTIVE;
    this.registerEvent(new DelinquencyClearedEvent(this._id));
  }

  /**
   * Suspends an ACTIVE or DELINQUENT membership.
   * @param reason Recorded suspension reason.
   */
  suspend(reason: string): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE && this._status !== MembershipStatus.DELINQUENT)
      throw new IllegalMembershipTransitionError('suspend requires ACTIVE or DELINQUENT');
    if (!reason?.trim()) throw new IllegalMembershipTransitionError('reason required');
    this._status = MembershipStatus.SUSPENDED;
    this.registerEvent(new MembershipSuspendedEvent(this._id, reason));
  }

  /** Reinstates a SUSPENDED membership back to ACTIVE. */
  reinstate(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.SUSPENDED)
      throw new IllegalMembershipTransitionError('reinstate requires SUSPENDED');
    this._status = MembershipStatus.ACTIVE;
    this.registerEvent(new MembershipReinstatedEvent(this._id));
  }

  /**
   * Terminates the membership. Terminal: nothing leaves TERMINATED.
   * @param reason Recorded termination reason.
   */
  terminate(reason: string): void {
    this.assertNotTerminated();
    if (!reason?.trim()) throw new IllegalMembershipTransitionError('reason required');
    this._status = MembershipStatus.TERMINATED;
    this.registerEvent(new MembershipTerminatedEvent(this._id, reason));
  }

  /**
   * Anchor: always answers, freezes the snapshot, never rewrites the past.
   * The verdict is judged by the injected eligibility policy; here only the
   * snapshot is frozen and the fact registered.
   * @param policy Strategy judging (status, snapshot); structurally matches
   * the ELIGIBILITY_POLICY port without importing the application layer.
   */
  judgeEligibility(policy: {
    judge(status: MembershipStatus, snapshot: EligibilitySnapshot): boolean;
  }): EligibilitySnapshot {
    const draft = EligibilitySnapshot.now(this._personId, this._communityId, this._status);
    const snapshot = draft.withVerdict(policy.judge(this._status, draft));
    this._lastEligibility = snapshot;
    this.registerEvent(new EligibilityJudgedEvent(this._personId, this._communityId, snapshot));
    return snapshot;
  }

  /** Guard: TERMINATED is terminal for every mutation. */
  private assertNotTerminated(): void {
    if (this._status === MembershipStatus.TERMINATED)
      throw new TerminationIsTerminalError('TERMINATED is terminal');
  }

  get id(): MembershipId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get communityId(): CommunityId { return this._communityId; }
  get status(): MembershipStatus { return this._status; }
  get role(): CommunityRole { return this._role; }
  get unit(): Unit | null { return this._unit; }
  get lastEligibility(): EligibilitySnapshot | null { return this._lastEligibility; }
}
