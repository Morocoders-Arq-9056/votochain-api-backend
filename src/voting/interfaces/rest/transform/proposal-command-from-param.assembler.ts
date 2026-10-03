import { CloseProposalCommand } from "../../../domain/model/commands/close-proposal.command.js";
import { OpenProposalCommand } from "../../../domain/model/commands/open-proposal.command.js";
import { TallyProposalCommand } from "../../../domain/model/commands/tally-proposal.command.js";
import { VotingParamsAssembler } from "./voting-params.assembler.js";

/**
 * Translates a proposal path id into single-target lifecycle commands.
 * Keeps `new Command` out of the controller, next to the resource
 * assemblers.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-01
 */
export class ProposalCommandFromParamAssembler {
  /**
   * Builds the open command from a path id.
   * @param id Raw proposal id path string.
   */
  static toOpenProposalCommand(id: string): OpenProposalCommand {
    return new OpenProposalCommand(VotingParamsAssembler.toProposalId(id));
  }

  /**
   * Builds the close command from a path id.
   * @param id Raw proposal id path string.
   */
  static toCloseProposalCommand(id: string): CloseProposalCommand {
    return new CloseProposalCommand(VotingParamsAssembler.toProposalId(id));
  }

  /**
   * Builds the tally command from a path id.
   * @param id Raw proposal id path string.
   */
  static toTallyProposalCommand(id: string): TallyProposalCommand {
    return new TallyProposalCommand(VotingParamsAssembler.toProposalId(id));
  }
}
