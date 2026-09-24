import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CommunityActivatedEvent } from "../../../domain/model/events/community-activated.event.js";
import { CommunityAdminAppointedEvent } from "../../../domain/model/events/community-admin-appointed.event.js";
import { CommunityAdminRemovedEvent } from "../../../domain/model/events/community-admin-removed.event.js";
import { CommunityArchivedEvent } from "../../../domain/model/events/community-archived.event.js";
import { CommunityReactivatedEvent } from "../../../domain/model/events/community-reactivated.event.js";
import { CommunityRegisteredEvent } from "../../../domain/model/events/community-registered.event.js";
import { CommunitySettingsUpdatedEvent } from "../../../domain/model/events/community-settings-updated.event.js";
import { CommunitySuspendedEvent } from "../../../domain/model/events/community-suspended.event.js";
import { VotingPolicyDefinedEvent } from "../../../domain/model/events/voting-policy-defined.event.js";

/**
 * In-module fan-out for Community domain events (Observer, never cross-BC).
 * Exempt logger with no business side-effects and no outbound ports:
 * Sprint-01 community holds no notification/session ports, and fan-out to
 * other contexts is pull via COMMUNITY_CONTEXT_FACADE, never push.
 * Skill rule: `@OnEvent` lives only in the emitting module.
 * Publish happens strictly after `UNIT_OF_WORK.run()` resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class CommunityEventLogger {
  private readonly logger = new Logger(CommunityEventLogger.name);

  /** Records a community registration. */
  @OnEvent(CommunityRegisteredEvent.eventName)
  async onRegistered(event: CommunityRegisteredEvent): Promise<void> {
    this.logger.log(`registered ${event.communityId.value}`);
  }

  /** Records a community activation. */
  @OnEvent(CommunityActivatedEvent.eventName)
  async onActivated(event: CommunityActivatedEvent): Promise<void> {
    this.logger.log(`activated ${event.communityId.value}`);
  }

  /** Records a settings update. */
  @OnEvent(CommunitySettingsUpdatedEvent.eventName)
  async onSettingsUpdated(event: CommunitySettingsUpdatedEvent): Promise<void> {
    this.logger.log(`settings updated ${event.communityId.value}`);
  }

  /** Records a voting policy definition with its supersedes link. */
  @OnEvent(VotingPolicyDefinedEvent.eventName)
  async onPolicyDefined(event: VotingPolicyDefinedEvent): Promise<void> {
    this.logger.log(`policy defined ${event.communityId.value}`);
  }

  /** Records an administrator appointment. */
  @OnEvent(CommunityAdminAppointedEvent.eventName)
  async onAdminAppointed(event: CommunityAdminAppointedEvent): Promise<void> {
    this.logger.log(`admin appointed ${event.personId.value} in ${event.communityId.value}`);
  }

  /** Records an administrator removal. */
  @OnEvent(CommunityAdminRemovedEvent.eventName)
  async onAdminRemoved(event: CommunityAdminRemovedEvent): Promise<void> {
    this.logger.log(`admin removed ${event.personId.value} from ${event.communityId.value}`);
  }

  /** Records a community suspension. */
  @OnEvent(CommunitySuspendedEvent.eventName)
  async onSuspended(event: CommunitySuspendedEvent): Promise<void> {
    this.logger.log(`suspended ${event.communityId.value}: ${event.reason}`);
  }

  /** Records a community reactivation. */
  @OnEvent(CommunityReactivatedEvent.eventName)
  async onReactivated(event: CommunityReactivatedEvent): Promise<void> {
    this.logger.log(`reactivated ${event.communityId.value}`);
  }

  /** Records a community archival. Terminal. */
  @OnEvent(CommunityArchivedEvent.eventName)
  async onArchived(event: CommunityArchivedEvent): Promise<void> {
    this.logger.log(`archived ${event.communityId.value}: ${event.reason}`);
  }
}
