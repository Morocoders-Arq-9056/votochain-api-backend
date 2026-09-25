import { AppointCommunityAdminCommand } from "../../../domain/model/commands/appoint-community-admin.command.js";
import { CommunityParamsAssembler } from "./community-params.assembler.js";
import { AppointAdminResource } from "../resources/appoint-admin.resource.js";

export class AppointCommunityAdminCommandFromResourceAssembler {
  static toCommand(id: string, resource: AppointAdminResource): AppointCommunityAdminCommand {
    return new AppointCommunityAdminCommand(
      CommunityParamsAssembler.toCommunityId(id),
      CommunityParamsAssembler.toPersonId(resource.personId),
    );
  }
}
