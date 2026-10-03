import { RegisterMembershipCommand } from "../../../domain/model/commands/register-membership.command.js";
import { MembershipParamsAssembler } from "./membership-params.assembler.js";
import { RegisterMembershipResource } from "../resources/register-membership.resource.js";

/**
 * Translates the registration resource into its command (resource → VO).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class RegisterMembershipCommandFromResourceAssembler {
  /**
   * Builds the command from a validated resource.
   * @param resource Validated registration resource.
   */
  static toCommandFromResource(resource: RegisterMembershipResource): RegisterMembershipCommand {
    return new RegisterMembershipCommand(
      MembershipParamsAssembler.toPersonId(resource.personId),
      MembershipParamsAssembler.toCommunityId(resource.communityId),
      resource.unitCode ? MembershipParamsAssembler.toUnit(resource.unitCode, resource.communityName) : null,
    );
  }
}
