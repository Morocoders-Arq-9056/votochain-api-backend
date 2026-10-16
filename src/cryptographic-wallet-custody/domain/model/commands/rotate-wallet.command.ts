import { DerivationPosition } from "../valueobjects/derivation-position.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class RotateWalletCommand {
  constructor(
    public readonly walletId: UserWalletId,
    public readonly newPosition: DerivationPosition,
  ) {
    if (!walletId) throw new Error('walletId required');
    if (!newPosition) throw new Error('newPosition required');
  }
}
