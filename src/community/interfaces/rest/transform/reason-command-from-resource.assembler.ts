import { ArchiveCommunityCommand } from "../../../domain/model/commands/archive-community.command.js";
import { SuspendCommunityCommand } from "../../../domain/model/commands/suspend-community.command.js";
import { CommunityParamsAssembler } from "./community-params.assembler.js";
import { ReasonResource } from "../resources/reason.resource.js";

export class ReasonCommandFromResourceAssembler {
  static toSuspendCommand(id: string, resource: ReasonResource): SuspendCommunityCommand {
    return new SuspendCommunityCommand(CommunityParamsAssembler.toCommunityId(id), resource.reason);
  }

  static toArchiveCommand(id: string, resource: ReasonResource): ArchiveCommunityCommand {
    return new ArchiveCommunityCommand(CommunityParamsAssembler.toCommunityId(id), resource.reason);
  }
}
