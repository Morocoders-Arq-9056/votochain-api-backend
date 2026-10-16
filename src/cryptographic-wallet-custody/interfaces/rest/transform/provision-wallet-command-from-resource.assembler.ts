import { ProvisionWalletCommand } from "../../../domain/model/commands/provision-wallet.command.js";
import { ProvisionWalletResource } from "../resources/provision-wallet.resource.js";
import { WalletParamsAssembler } from "./wallet-params.assembler.js";

/** Translates the provision resource into its command (resource → VO). */
export class ProvisionWalletCommandFromResourceAssembler {
  static toCommandFromResource(resource: ProvisionWalletResource): ProvisionWalletCommand {
    return new ProvisionWalletCommand(WalletParamsAssembler.toPersonId(resource.personId));
  }
}
