import { UserWalletId } from "../model/valueobjects/user-wallet-id.value-object.js";
import { ProvisionWalletCommand } from "../model/commands/provision-wallet.command.js";
import { SignVoteContentCommand } from "../model/commands/sign-vote-content.command.js";
import { RotateWalletCommand } from "../model/commands/rotate-wallet.command.js";
import { SuspendWalletCommand } from "../model/commands/suspend-wallet.command.js";
import { RetireWalletCommand } from "../model/commands/retire-wallet.command.js";
import { RetireWalletByPersonCommand } from "../model/commands/retire-wallet-by-person.command.js";

/**
 * Domain port for wallet writes. One method per command,
 * `methodName = lowerCamel(ClassName without Command)`, receiving the object.
 */
export interface WalletCommandService {
  provisionWallet(command: ProvisionWalletCommand): Promise<UserWalletId>;
  signVoteContent(command: SignVoteContentCommand): Promise<string>;
  rotateWallet(command: RotateWalletCommand): Promise<void>;
  suspendWallet(command: SuspendWalletCommand): Promise<void>;
  retireWallet(command: RetireWalletCommand): Promise<void>;
  /**
   * Erasure execution (R12): retires the person's live capability, idempotent.
   * @returns 1 when a live capability was retired, 0 when there was none.
   */
  retireWalletByPerson(command: RetireWalletByPersonCommand): Promise<number>;
}
export const WALLET_COMMAND_SERVICE = Symbol('WALLET_COMMAND_SERVICE');
