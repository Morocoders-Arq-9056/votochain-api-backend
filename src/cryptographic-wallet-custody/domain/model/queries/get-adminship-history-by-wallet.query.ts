import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class GetAdminshipHistoryByWalletQuery {
  constructor(public readonly walletId: UserWalletId) {}
}
