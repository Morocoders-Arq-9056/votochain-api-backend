import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TallyProposalCommand } from "../../../domain/model/commands/tally-proposal.command.js";
import { ProposalClosedEvent } from "../../../domain/model/events/proposal-closed.event.js";
import { PROPOSAL_COMMAND_SERVICE, type ProposalCommandService } from "../../../domain/services/proposal-command.service.js";

/**
 * UC8 tally trigger: a closed proposal is tallied against the quorum
 * snapshot frozen at open(). Failures are logged, never retried inline.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ProposalClosedEventHandler {
  private readonly logger = new Logger(ProposalClosedEventHandler.name);

  constructor(@Inject(PROPOSAL_COMMAND_SERVICE) private readonly proposals: ProposalCommandService) {}

  @OnEvent(ProposalClosedEvent.eventName, { async: true })
  async handleProposalClosed(event: ProposalClosedEvent): Promise<void> {
    try {
      await this.proposals.tallyProposal(new TallyProposalCommand(event.proposalId));
    } catch (e) {
      this.logger.error(`UC8 failed for proposal ${event.proposalId.value}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
