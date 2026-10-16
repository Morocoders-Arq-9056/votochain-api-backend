import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class GetUserWalletByIdQuery {
  constructor(public readonly walletId: UserWalletId) {}
}
