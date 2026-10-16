import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DerivationPosition } from "../valueobjects/derivation-position.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class WalletRotatedEvent implements DomainEvent {
  static readonly eventName = 'WalletRotated';
  readonly eventName = WalletRotatedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly walletId: UserWalletId,
    public readonly fromPosition: DerivationPosition,
    public readonly toPosition: DerivationPosition,
  ) {}
}
