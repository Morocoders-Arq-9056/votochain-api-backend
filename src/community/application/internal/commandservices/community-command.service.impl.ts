import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CommunityCommandService } from "../../../domain/services/community-command.service.js";
import { COMMUNITY_REPOSITORY } from "../../../domain/repositories/community.repository.js";
import type { CommunityRepository } from "../../../domain/repositories/community.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { EXTERNAL_IAM_SERVICE } from "../outboundservices/acl/external-iam.service.js";
import type { ExternalIamService } from "../outboundservices/acl/external-iam.service.js";
import { ActivateCommunityCommand } from "../../../domain/model/commands/activate-community.command.js";
import { AppointCommunityAdminCommand } from "../../../domain/model/commands/appoint-community-admin.command.js";
import { ArchiveCommunityCommand } from "../../../domain/model/commands/archive-community.command.js";
import { DefineVotingPolicyCommand } from "../../../domain/model/commands/define-voting-policy.command.js";
import { ReactivateCommunityCommand } from "../../../domain/model/commands/reactivate-community.command.js";
import { RegisterCommunityCommand } from "../../../domain/model/commands/register-community.command.js";
import { RemoveCommunityAdminCommand } from "../../../domain/model/commands/remove-community-admin.command.js";
import { SuspendCommunityCommand } from "../../../domain/model/commands/suspend-community.command.js";
import { UpdateCommunitySettingsCommand } from "../../../domain/model/commands/update-community-settings.command.js";
import { Community } from "../../../domain/model/aggregates/community.aggregate.js";
import { CommunityId } from "../../../domain/model/valueobjects/community-id.value-object.js";
import { CommunityAlreadyExistsError } from "../../../domain/exceptions/community-already-exists.error.js";
import { CommunityNotFoundError } from "../../../domain/exceptions/community-not-found.error.js";
import { PersonUnknownError } from "../../../domain/exceptions/person-unknown.error.js";

/**
 * Application orchestration for the 9 Community write use cases.
 *
 * Holds no business rules: loads the aggregate, invokes its behavior, saves
 * through the repository port. The UC5 person-existence gate runs BEFORE
 * `uow.run()` — the transaction groups DB statements only, never network I/O.
 * Domain events are published strictly after the commit resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityCommandServiceImpl implements CommunityCommandService {
  /**
   * Wires the command service over persistence, transactions and gates.
   * @param communities Repository port for the Community aggregate.
   * @param unitOfWork Transaction boundary for writes.
   * @param iam Identity-existence gate for UC5 (appoint admin).
   * @param eventEmitter In-process bus for in-module handlers only.
   */
  constructor(
    @Inject(COMMUNITY_REPOSITORY) private readonly communities: CommunityRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(EXTERNAL_IAM_SERVICE) private readonly iam: ExternalIamService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers a fresh community; refuses names held by a live community.
   * @inheritdoc
   */
  async registerCommunity(command: RegisterCommunityCommand): Promise<CommunityId> {
    const community = await this.unitOfWork.run(async () => {
      if (await this.communities.findByName(command.settings.name))
        throw new CommunityAlreadyExistsError('community already exists');
      const c = Community.register({ settings: command.settings, personId: command.personId });
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
    return community.id;
  }

  /**
   * Activates a REGISTERED community once policy and admin are in place.
   * @inheritdoc
   */
  async activateCommunity(command: ActivateCommunityCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.activate();
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Updates the community facts without touching standing history.
   * @inheritdoc
   */
  async updateCommunitySettings(command: UpdateCommunitySettingsCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.updateSettings(command.settings);
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Defines a new voting policy version, superseding the previous.
   * Racing definitions serialize into the supersede chain inside one UoW.
   * @inheritdoc
   */
  async defineVotingPolicy(command: DefineVotingPolicyCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.definePolicy({ threshold: command.threshold, basis: command.basis, majorityRule: command.majorityRule });
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Entrusts a person as administrator after judging existence in IAM.
   * @inheritdoc
   */
  async appointCommunityAdmin(command: AppointCommunityAdminCommand): Promise<void> {
    if (!(await this.iam.personExists(command.personId.value)))
      throw new PersonUnknownError('person unknown');
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.appointAdmin(command.personId);
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Removes an administrator; the aggregate refuses the last one while ACTIVE.
   * @inheritdoc
   */
  async removeCommunityAdmin(command: RemoveCommunityAdminCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.removeAdmin(command.personId);
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Suspends an ACTIVE community with a recorded reason.
   * @inheritdoc
   */
  async suspendCommunity(command: SuspendCommunityCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.suspend(command.reason);
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Reactivates a SUSPENDED community once the cause is resolved.
   * @inheritdoc
   */
  async reactivateCommunity(command: ReactivateCommunityCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.reactivate();
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Archives an ACTIVE or SUSPENDED community. Terminal.
   * @inheritdoc
   */
  async archiveCommunity(command: ArchiveCommunityCommand): Promise<void> {
    const community = await this.unitOfWork.run(async () => {
      const c = await this.require(command.communityId);
      c.archive(command.reason);
      await this.communities.save(c);
      return c;
    });
    this.publishDomainEvents(community);
  }

  /**
   * Loads the aggregate or raises the read/update rejection for unknown ids.
   * @param id Community identity id.
   */
  private async require(id: CommunityId): Promise<Community> {
    const community = await this.communities.findById(id);
    if (!community) throw new CommunityNotFoundError('community not found');
    return community;
  }

  /**
   * Drains buffered domain events after commit; never called inside run().
   * @param community Aggregate whose events are published to in-module handlers.
   */
  private publishDomainEvents(community: Community): void {
    for (const event of community.pullDomainEvents()) {
      this.eventEmitter.emit(event.eventName, event);
    }
  }
}
