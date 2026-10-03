import { DraftProposalCommand } from "../../../domain/model/commands/draft-proposal.command.js";
import { DraftProposalResource } from "../resources/draft-proposal.resource.js";
import { VotingParamsAssembler } from "./voting-params.assembler.js";

export class DraftProposalCommandFromResourceAssembler {
  static toCommandFromResource(resource: DraftProposalResource): DraftProposalCommand {
    return new DraftProposalCommand(
      VotingParamsAssembler.toCommunityId(resource.communityId),
      VotingParamsAssembler.toBallotOptions(resource.options),
    );
  }
}
