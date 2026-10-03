import { CastVoteCommand } from "../../../domain/model/commands/cast-vote.command.js";
import { CastVoteResource } from "../resources/cast-vote.resource.js";
import { VotingParamsAssembler } from "./voting-params.assembler.js";

export class CastVoteCommandFromResourceAssembler {
  static toCommandFromResource(resource: CastVoteResource): CastVoteCommand {
    return new CastVoteCommand(
      VotingParamsAssembler.toAuthorizationId(resource.authorizationId),
      VotingParamsAssembler.toChoice(resource.choice),
    );
  }
}
