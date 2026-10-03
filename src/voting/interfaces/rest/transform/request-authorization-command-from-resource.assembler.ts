import { RequestVoteAuthorizationCommand } from "../../../domain/model/commands/request-vote-authorization.command.js";
import { RequestAuthorizationResource } from "../resources/request-authorization.resource.js";
import { VotingParamsAssembler } from "./voting-params.assembler.js";

export class RequestAuthorizationCommandFromResourceAssembler {
  static toCommandFromResource(resource: RequestAuthorizationResource): RequestVoteAuthorizationCommand {
    return new RequestVoteAuthorizationCommand(
      VotingParamsAssembler.toProposalId(resource.proposalId),
      VotingParamsAssembler.toVoterAddress(resource.voterAddress),
      VotingParamsAssembler.toPersonId(resource.personId),
      resource.walletHint ?? null,
    );
  }
}
