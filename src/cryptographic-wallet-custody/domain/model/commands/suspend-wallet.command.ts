import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class SuspendWalletCommand {
  constructor(
    public readonly walletId: UserWalletId,
    public readonly reason: string,
  ) {
    if (!walletId) throw new Error('walletId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
