import { CommunitySettings } from "../../../domain/model/valueobjects/community-settings.value-object.js";
import { UpdateCommunitySettingsCommand } from "../../../domain/model/commands/update-community-settings.command.js";
import { CommunityParamsAssembler } from "./community-params.assembler.js";
import { UpdateCommunitySettingsResource } from "../resources/update-community-settings.resource.js";

export class UpdateCommunitySettingsCommandFromResourceAssembler {
  static toCommand(id: string, resource: UpdateCommunitySettingsResource): UpdateCommunitySettingsCommand {
    return new UpdateCommunitySettingsCommand(
      CommunityParamsAssembler.toCommunityId(id),
      CommunitySettings.create({ name: resource.name, domicile: resource.domicile, contact: resource.contact }),
    );
  }
}
