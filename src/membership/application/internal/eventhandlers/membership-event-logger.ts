import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CommunityRoleAssignedEvent } from "../../../domain/model/events/community-role-assigned.event.js";
import { DelinquencyClearedEvent } from "../../../domain/model/events/delinquency-cleared.event.js";
import { MemberMarkedDelinquentEvent } from "../../../domain/model/events/member-marked-delinquent.event.js";
import { MembershipActivatedEvent } from "../../../domain/model/events/membership-activated.event.js";
import { MembershipRegisteredEvent } from "../../../domain/model/events/membership-registered.event.js";
import { MembershipReinstatedEvent } from "../../../domain/model/events/membership-reinstated.event.js";
import { MembershipSuspendedEvent } from "../../../domain/model/events/membership-suspended.event.js";
import { MembershipTerminatedEvent } from "../../../domain/model/events/membership-terminated.event.js";
import { UnitAssignedEvent } from "../../../domain/model/events/unit-assigned.event.js";

/**
 * In-module fan-out for Membership domain events (Observer, never cross-BC).
 * Exempt logger with no business side-effects and no outbound ports:
 * fan-out to other contexts is pull via MEMBERSHIP_CONTEXT_FACADE, never
 * push. `EligibilityJudged` keeps its real handler
 * (`EligibilityJudgedEventHandler`, UC10 anchor toward Voting); the nine
 * lifecycle events below are observed here log-only.
 * Skill rule: `@OnEvent` lives only in the emitting module.
 * Publish happens strictly after `UNIT_OF_WORK.run()` resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class MembershipEventLogger {
  private readonly logger = new Logger(MembershipEventLogger.name);

  /** Records a membership registration. */
  @OnEvent(MembershipRegisteredEvent.eventName)
  async onRegistered(event: MembershipRegisteredEvent): Promise<void> {
    this.logger.log(`registered ${event.membershipId.value} for ${event.personId.value} in ${event.communityId.value}`);
  }

  /** Records a membership activation. */
  @OnEvent(MembershipActivatedEvent.eventName)
  async onActivated(event: MembershipActivatedEvent): Promise<void> {
    this.logger.log(`activated ${event.membershipId.value}`);
  }

  /** Records a dwelling-unit assignment. */
  @OnEvent(UnitAssignedEvent.eventName)
  async onUnitAssigned(event: UnitAssignedEvent): Promise<void> {
    this.logger.log(`unit assigned ${event.unit.code} to ${event.membershipId.value}`);
  }

  /** Records a community-role assignment. */
  @OnEvent(CommunityRoleAssignedEvent.eventName)
  async onRoleAssigned(event: CommunityRoleAssignedEvent): Promise<void> {
    this.logger.log(`role assigned ${event.role.kind} to ${event.membershipId.value}`);
  }

  /** Records a delinquency marking. */
  @OnEvent(MemberMarkedDelinquentEvent.eventName)
  async onMarkedDelinquent(event: MemberMarkedDelinquentEvent): Promise<void> {
    this.logger.log(`marked delinquent ${event.membershipId.value}: ${event.reason}`);
  }

  /** Records a delinquency clearance. */
  @OnEvent(DelinquencyClearedEvent.eventName)
  async onDelinquencyCleared(event: DelinquencyClearedEvent): Promise<void> {
    this.logger.log(`delinquency cleared ${event.membershipId.value}`);
  }

  /** Records a membership suspension. */
  @OnEvent(MembershipSuspendedEvent.eventName)
  async onSuspended(event: MembershipSuspendedEvent): Promise<void> {
    this.logger.log(`suspended ${event.membershipId.value}: ${event.reason}`);
  }

  /** Records a membership reinstatement. */
  @OnEvent(MembershipReinstatedEvent.eventName)
  async onReinstated(event: MembershipReinstatedEvent): Promise<void> {
    this.logger.log(`reinstated ${event.membershipId.value}`);
  }

  /** Records a membership termination. Terminal. */
  @OnEvent(MembershipTerminatedEvent.eventName)
  async onTerminated(event: MembershipTerminatedEvent): Promise<void> {
    this.logger.log(`terminated ${event.membershipId.value}: ${event.reason}`);
  }
}
