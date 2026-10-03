import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EligibilityJudgedEvent } from "../../../domain/model/events/eligibility-judged.event.js";
import { type ExternalVotingService } from "../outboundservices/acl/external-voting.service.js";

/**
 * In-module reaction to a frozen eligibility judgment (UC10 anchor): forwards
 * the fact to Voting through the ACL with primitives. Lives in THIS module —
 * no other module subscribes to Membership events (single bus, no isolation).
 * Publish happens strictly after `UNIT_OF_WORK.run()` resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class EligibilityJudgedEventHandler {
  private readonly logger = new Logger(EligibilityJudgedEventHandler.name);

  /**
   * Wires the handler over the Voting ACL port.
   * @param voting ACL adapter toward the Voting facade (log-only until Voting lands).
   */
  constructor(
    private readonly voting: ExternalVotingService,
  ) {}

  /**
   * Forwards the frozen judgment so Voting can freeze its own copy.
   * @param event Judgment carrying typed VOs and the snapshot.
   */
  @OnEvent(EligibilityJudgedEvent.eventName, { async: true })
  async handleEligibilityJudged(event: EligibilityJudgedEvent): Promise<void> {
    try {
      this.logger.log(`eligibility judged ${event.personId.value} in ${event.communityId.value}: ${event.snapshot.reference}`);
      await this.voting.eligibilityJudged(
        event.personId.value,
        event.communityId.value,
        event.snapshot.reference,
      );
    } catch (err) {
      this.logger.error(`Voting forward failed for ${event.personId.value}: ${String(err)}`);
    }
  }
}
