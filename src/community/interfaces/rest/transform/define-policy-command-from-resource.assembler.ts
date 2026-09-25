import { DefineVotingPolicyCommand } from "../../../domain/model/commands/define-voting-policy.command.js";
import { CommunityParamsAssembler } from "./community-params.assembler.js";
import { DefinePolicyResource } from "../resources/define-policy.resource.js";

export class DefineVotingPolicyCommandFromResourceAssembler {
  static toCommand(id: string, resource: DefinePolicyResource): DefineVotingPolicyCommand {
    return new DefineVotingPolicyCommand(
      CommunityParamsAssembler.toCommunityId(id),
      resource.threshold,
      resource.basis,
      resource.majorityRule,
    );
  }
}
