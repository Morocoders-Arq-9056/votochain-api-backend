import { AggregateRoot } from "../../../../shared/domain/model/aggregate-root.js";
import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { AdminAlreadyAppointedError } from "../../exceptions/admin-already-appointed.error.js";
import { AdminNotHeldError } from "../../exceptions/admin-not-held.error.js";
import { ArchivedIsTerminalError } from "../../exceptions/archived-is-terminal.error.js";
import { IllegalCommunityTransitionError } from "../../exceptions/illegal-community-transition.error.js";
import { LastAdministratorError } from "../../exceptions/last-administrator.error.js";
import { PolicyUndefinedError } from "../../exceptions/policy-undefined.error.js";
import { CommunityActivatedEvent } from "../events/community-activated.event.js";
import { CommunityAdminAppointedEvent } from "../events/community-admin-appointed.event.js";
import { CommunityAdminRemovedEvent } from "../events/community-admin-removed.event.js";
import { CommunityArchivedEvent } from "../events/community-archived.event.js";
import { CommunityReactivatedEvent } from "../events/community-reactivated.event.js";
import { CommunityRegisteredEvent } from "../events/community-registered.event.js";
import { CommunitySettingsUpdatedEvent } from "../events/community-settings-updated.event.js";
import { CommunitySuspendedEvent } from "../events/community-suspended.event.js";
import { VotingPolicyDefinedEvent } from "../events/voting-policy-defined.event.js";
import { CommunityAdmin } from "../valueobjects/community-admin.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { CommunitySettings } from "../valueobjects/community-settings.value-object.js";
import { CommunityStandable } from "../valueobjects/community-standable.value-object.js";
import { CommunityStanding } from "../valueobjects/community-standing.value-object.js";
import { CommunityStandingAnswer } from "../valueobjects/community-standing-answer.value-object.js";
import { VotingPolicy } from "../valueobjects/voting-policy.value-object.js";

/**
 * Aggregate root representing a community.
 *
 * Single consistency boundary for settings, voting policy (supersede-chain)
 * and the administrator list. Never holds the member list — that relationship
 * lives in Membership. Other contexts read standing and policy by reference
 * and freeze copies; later changes here never rewrite those frozen copies.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class Community extends AggregateRoot implements CommunityStandable {
  /**
   * Creates the aggregate; use {@link Community.register} for new communities
   * or {@link Community.rehydrate} to rebuild stored state without events.
   */
  private constructor(
    private readonly _id: CommunityId,
    private _standing: CommunityStanding,
    private _settings: CommunitySettings,
    private _policy: VotingPolicy | null,
    private _admins: CommunityAdmin[],
  ) { super(); }

  /**
   * Registers a brand-new community. Always REGISTERED; raises CommunityRegisteredEvent.
   * @param input Carries the initial settings and the founding administrator's person.
   */
  static register(input: { settings: CommunitySettings; personId: PersonId }): Community {
    const community = new Community(CommunityId.generate(), CommunityStanding.REGISTERED,
      input.settings, null, [CommunityAdmin.appoint(input.personId)]);
    community.registerEvent(new CommunityRegisteredEvent(community._id, community._settings));
    return community;
  }

  /**
   * Rebuilds a stored community without raising events or assuming status.
   */
  static rehydrate(input: { id: CommunityId; standing: CommunityStanding;
    settings: CommunitySettings; policy: VotingPolicy | null;
    admins: CommunityAdmin[] }): Community {
    return new Community(input.id, input.standing, input.settings, input.policy, [...input.admins]);
  }

  /**
   * Validates a standing transition, mutates standing and registers the event.
   * Shared guard for activate/suspend/reactivate/archive; throws on illegal origin state.
   */
  protected applyStandingTransition(from: CommunityStanding, to: CommunityStanding, event: DomainEvent): void {
    if (this._standing !== from) throw new IllegalCommunityTransitionError(`standing ${this._standing} != ${from}`);
    this._standing = to;
    this.registerEvent(event);
  }

  /**
   * Guard: every mutation except rehydrate requires a non-ARCHIVED community.
   */
  protected assertMutable(): void {
    if (this._standing === CommunityStanding.ARCHIVED) throw new ArchivedIsTerminalError('terminal');
  }

  /**
   * Activates a REGISTERED community once policy is defined and an administrator named.
   */
  activate(): void {
    if (this._standing !== CommunityStanding.REGISTERED) throw new IllegalCommunityTransitionError('not registrable');
    if (!this._policy) throw new PolicyUndefinedError('policy required');
    if (this._admins.length < 1) throw new LastAdministratorError('need >=1 admin');
    this.applyStandingTransition(CommunityStanding.REGISTERED, CommunityStanding.ACTIVE, new CommunityActivatedEvent(this._id));
  }

  /**
   * Updates the community facts without touching standing history.
   * @param settings The new well-formed settings.
   */
  updateSettings(settings: CommunitySettings): void {
    this.assertMutable();
    this._settings = settings;
    this.registerEvent(new CommunitySettingsUpdatedEvent(this._id, this._settings));
  }

  /**
   * Defines a new voting policy version. The new version supersedes the previous;
   * superseded versions remain history, never edited. Only future proposal
   * openings read it — already-frozen copies elsewhere stay untouched.
   * @param input The threshold, basis and majority rule of the new version.
   */
  definePolicy(input: { threshold: number; basis: string; majorityRule: string }): void {
    this.assertMutable();
    const supersedes = this._policy;
    this._policy = VotingPolicy.define({ ...input, supersedes });
    this.registerEvent(new VotingPolicyDefinedEvent(this._id, this._policy, supersedes));
  }

  /**
   * Entrusts a person as administrator.
   * @param personId The person to entrust; existence is judged in IAM.
   */
  appointAdmin(personId: PersonId): void {
    this.assertMutable();
    if (this._admins.some((a) => a.personId.equals(personId))) throw new AdminAlreadyAppointedError('already admin');
    this._admins = [...this._admins, CommunityAdmin.appoint(personId)];
    this.registerEvent(new CommunityAdminAppointedEvent(this._id, personId));
  }

  /**
   * Removes an administrator, refusing when it would leave an ACTIVE
   * community with no administrator.
   * @param person The administrator to remove.
   */
  removeAdmin(person: PersonId): void {
    this.assertMutable();
    if (!this._admins.some((a) => a.personId.equals(person))) throw new AdminNotHeldError('not admin');
    if (this._standing === CommunityStanding.ACTIVE && this._admins.length === 1)
      throw new LastAdministratorError('last admin while active');
    this._admins = this._admins.filter((a) => !a.personId.equals(person));
    this.registerEvent(new CommunityAdminRemovedEvent(this._id, person));
  }

  /**
   * Suspends an ACTIVE community. New proposals and memberships are refused
   * from that moment; in-flight votes close under their frozen rule.
   * @param reason The recorded reason for suspension.
   */
  suspend(reason: string): void {
    this.assertMutable();
    this.applyStandingTransition(CommunityStanding.ACTIVE, CommunityStanding.SUSPENDED, new CommunitySuspendedEvent(this._id, reason));
  }

  /**
   * Reactivates a SUSPENDED community once the cause is resolved.
   */
  reactivate(): void {
    this.applyStandingTransition(CommunityStanding.SUSPENDED, CommunityStanding.ACTIVE, new CommunityReactivatedEvent(this._id));
  }

  /**
   * Archives an ACTIVE or SUSPENDED community. Terminal: nothing leaves ARCHIVED.
   * @param reason The recorded reason for archival.
   */
  archive(reason: string): void {
    this.assertMutable();
    if (this._standing !== CommunityStanding.ACTIVE && this._standing !== CommunityStanding.SUSPENDED)
      throw new IllegalCommunityTransitionError('archive only from ACTIVE/SUSPENDED');
    this.applyStandingTransition(this._standing, CommunityStanding.ARCHIVED, new CommunityArchivedEvent(this._id, reason));
  }

  /**
   * Answers the standing question: current standing plus whether members
   * and proposals are accepted now. Mutates nothing, produces no facts.
   */
  answerStanding(): CommunityStandingAnswer {
    return CommunityStandingAnswer.answer(this._standing);
  }

  /**
   * Answers the policy question: the current threshold, basis and majority rule.
   * Mutates nothing, produces no facts.
   */
  answerPolicy(): VotingPolicy {
    if (!this._policy) throw new PolicyUndefinedError('policy undefined');
    return this._policy;
  }

  get id(): CommunityId { return this._id; }
  get standing(): CommunityStanding { return this._standing; }
  get settings(): CommunitySettings { return this._settings; }
  get policy(): VotingPolicy | null { return this._policy; }
  get admins(): CommunityAdmin[] { return [...this._admins]; }
}
