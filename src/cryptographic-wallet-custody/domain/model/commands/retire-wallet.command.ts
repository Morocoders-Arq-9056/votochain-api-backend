import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class RetireWalletCommand {
  constructor(public readonly walletId: UserWalletId) {
    if (!walletId) throw new Error('walletId required');
  }
}
