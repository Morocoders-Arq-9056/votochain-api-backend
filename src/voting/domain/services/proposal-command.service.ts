import { CloseProposalCommand } from "../model/commands/close-proposal.command.js";
import { DraftProposalCommand } from "../model/commands/draft-proposal.command.js";
import { OpenProposalCommand } from "../model/commands/open-proposal.command.js";
import { TallyProposalCommand } from "../model/commands/tally-proposal.command.js";
import { ProposalId } from "../model/valueobjects/proposal-id.value-object.js";

export const PROPOSAL_COMMAND_SERVICE = Symbol('PROPOSAL_COMMAND_SERVICE');

/**
 * Domain port for proposal writes (UC1 draft, UC2 open, UC7 close, UC8 tally).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */

export interface ProposalCommandService {
  draftProposal(command: DraftProposalCommand): Promise<ProposalId>;
  openProposal(command: OpenProposalCommand): Promise<void>;
  closeProposal(command: CloseProposalCommand): Promise<void>;
  tallyProposal(command: TallyProposalCommand): Promise<void>;
}
