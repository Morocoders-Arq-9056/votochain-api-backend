import { CommunitySettings } from "../../../domain/model/valueobjects/community-settings.value-object.js";
import { RegisterCommunityCommand } from "../../../domain/model/commands/register-community.command.js";
import { CommunityParamsAssembler } from "./community-params.assembler.js";
import { RegisterCommunityResource } from "../resources/register-community.resource.js";

export class RegisterCommunityCommandFromResourceAssembler {
  static toCommandFromResource(resource: RegisterCommunityResource): RegisterCommunityCommand {
    return new RegisterCommunityCommand(
      CommunitySettings.create({ name: resource.name, domicile: resource.domicile, contact: resource.contact }),
      CommunityParamsAssembler.toPersonId(resource.adminPersonId),
    );
  }
}
