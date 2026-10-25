import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MembershipCommandService } from "../../../domain/services/membership-command.service.js";
import { MEMBERSHIP_REPOSITORY } from "../../../domain/repositories/membership.repository.js";
import type { MembershipRepository } from "../../../domain/repositories/membership.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { ELIGIBILITY_POLICY } from "../outboundservices/eligibility/eligibility-policy.service.js";
import type { EligibilityPolicyService } from "../outboundservices/eligibility/eligibility-policy.service.js";
import { type ExternalCommunityService } from "../outboundservices/acl/external-community.service.js";
import { type ExternalIamService } from "../outboundservices/acl/external-iam.service.js";
import { ActivateMembershipCommand } from "../../../domain/model/commands/activate-membership.command.js";
import { AssignCommunityRoleCommand } from "../../../domain/model/commands/assign-community-role.command.js";
import { AssignUnitCommand } from "../../../domain/model/commands/assign-unit.command.js";
import { ClearDelinquencyCommand } from "../../../domain/model/commands/clear-delinquency.command.js";
import { JudgeEligibilityCommand } from "../../../domain/model/commands/judge-eligibility.command.js";
import { MarkDelinquentCommand } from "../../../domain/model/commands/mark-delinquent.command.js";
import { RegisterMembershipCommand } from "../../../domain/model/commands/register-membership.command.js";
import { ReinstateMembershipCommand } from "../../../domain/model/commands/reinstate-membership.command.js";
import { SuspendMembershipCommand } from "../../../domain/model/commands/suspend-membership.command.js";
import { TerminateMembershipCommand } from "../../../domain/model/commands/terminate-membership.command.js";
import { EraseMembershipsByPersonCommand } from "../../../domain/model/commands/erase-memberships-by-person.command.js";
import { Membership } from "../../../domain/model/aggregates/membership.aggregate.js";
import { EligibilitySnapshot } from "../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipId } from "../../../domain/model/valueobjects/membership-id.value-object.js";
import { CommunityNotAcceptingMembersError } from "../../../domain/exceptions/community-not-accepting-members.error.js";
import { MembershipAlreadyExistsError } from "../../../domain/exceptions/membership-already-exists.error.js";
import { MembershipNotFoundError } from "../../../domain/exceptions/membership-not-found.error.js";
import { PersonUnknownError } from "../../../domain/exceptions/person-unknown.error.js";

/**
 * Application orchestration for the 10 Membership write use cases.
 *
 * Holds no business rules: loads the aggregate, invokes its behavior, saves
 * through the repository port. The UC1 ACL gates run BEFORE `uow.run()` —
 * the transaction groups DB statements only, never calls to other contexts.
 * Domain events are published strictly after the commit resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipCommandServiceImpl implements MembershipCommandService {
  /**
   * Wires the command service over persistence, transactions and gates.
   * @param memberships Repository port for the Membership aggregate.
   * @param unitOfWork Transaction boundary for writes.
   * @param iam Identity-existence gate for UC1 (register).
   * @param communities Acceptance gate for UC1 (register).
   * @param policy Eligibility strategy for UC10 (judge).
   * @param eventEmitter In-process bus for in-module handlers only.
   */
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly iam: ExternalIamService,
    private readonly communities: ExternalCommunityService,
    @Inject(ELIGIBILITY_POLICY) private readonly policy: EligibilityPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers a fresh pair after the IAM/community gates; refuses live pairs.
   * @inheritdoc
   */
  async registerMembership(command: RegisterMembershipCommand): Promise<MembershipId> {
    if (!(await this.iam.personExists(command.personId.value))) throw new PersonUnknownError();
    if (!(await this.communities.acceptsMembers(command.communityId.value)))
      throw new CommunityNotAcceptingMembersError('community not accepting members');
    const membership = await this.unitOfWork.run(async () => {
      if (await this.memberships.findLiveByPersonAndCommunity(command.personId, command.communityId))
        throw new MembershipAlreadyExistsError('live pair already exists');
      const created = Membership.register(command.personId, command.communityId, command.unit ?? null);
      await this.memberships.save(created);
      return created;
    });
    this.publishDomainEvents(membership);
    return membership.id;
  }

  /**
   * Activates a REQUESTED membership.
   * @inheritdoc
   */
  async activateMembership(command: ActivateMembershipCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.activate();
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Assigns the dwelling unit without touching standing history.
   * @inheritdoc
   */
  async assignUnit(command: AssignUnitCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.assignUnit(command.unit);
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Assigns the community role; the aggregate requires ACTIVE.
   * @inheritdoc
   */
  async assignCommunityRole(command: AssignCommunityRoleCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.assignRole(command.role);
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Marks an ACTIVE membership delinquent.
   * @inheritdoc
   */
  async markDelinquent(command: MarkDelinquentCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.markDelinquent(command.reason);
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Clears delinquency back to ACTIVE.
   * @inheritdoc
   */
  async clearDelinquency(command: ClearDelinquencyCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.clearDelinquency();
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Suspends an ACTIVE or DELINQUENT membership.
   * @inheritdoc
   */
  async suspendMembership(command: SuspendMembershipCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.suspend(command.reason);
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Reinstates a SUSPENDED membership back to ACTIVE.
   * @inheritdoc
   */
  async reinstateMembership(command: ReinstateMembershipCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.reinstate();
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Terminates the membership. Terminal.
   * @inheritdoc
   */
  async terminateMembership(command: TerminateMembershipCommand): Promise<void> {
    const membership = await this.unitOfWork.run(async () => {
      const m = await this.require(command.membershipId);
      m.terminate(command.reason);
      await this.memberships.save(m);
      return m;
    });
    this.publishDomainEvents(membership);
  }

  /**
   * Erasure execution: terminates every live membership of one person with
   * the audit reason `ERASURE_REQUEST`. One UoW, events published after
   * commit; zero live memberships is success with count 0 (idempotent).
   * @inheritdoc
   */
  async eraseMembershipsByPerson(command: EraseMembershipsByPersonCommand): Promise<number> {
    const erased = await this.unitOfWork.run(async () => {
      const live = await this.memberships.findLiveByPerson(command.personId);
      for (const m of live) {
        m.terminate('ERASURE_REQUEST');
        await this.memberships.save(m);
      }
      return live;
    });
    for (const m of erased) this.publishDomainEvents(m);
    return erased.length;
  }

  /**
   * Judges eligibility now. Ghost contract: absence answers NOT_A_MEMBER
   * through a transient ghost — never 404, never persisted — while the
   * judgment itself IS published (`EligibilityJudgedEvent` after commit).
   * @inheritdoc
   */
  async judgeEligibility(command: JudgeEligibilityCommand): Promise<EligibilitySnapshot> {
    let snapshot!: EligibilitySnapshot;
    const target = await this.unitOfWork.run(async () => {
      const found = await this.memberships.findLiveByPersonAndCommunity(command.personId, command.communityId);
      const t = found ?? Membership.ghost(command.personId, command.communityId);
      snapshot = t.judgeEligibility(this.policy);
      if (found) await this.memberships.save(t);
      return t;
    });
    this.publishDomainEvents(target);
    return snapshot;
  }

  /**
   * Loads the aggregate or raises the read/update rejection for unknown ids.
   * @param id Membership identity.
   */
  private async require(id: MembershipId): Promise<Membership> {
    const membership = await this.memberships.findById(id);
    if (!membership) throw new MembershipNotFoundError('membership not found');
    return membership;
  }

  /**
   * Drains buffered domain events after commit; never called inside run().
   * @param membership Aggregate whose events are published to in-module handlers.
   */
  private publishDomainEvents(membership: Membership): void {
    for (const event of membership.pullDomainEvents()) {
      this.eventEmitter.emit(event.eventName, event);
    }
  }
}
