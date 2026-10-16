import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class WalletSuspendedEvent implements DomainEvent {
  static readonly eventName = 'WalletSuspended';
  readonly eventName = WalletSuspendedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly walletId: UserWalletId,
    public readonly reason: string,
  ) {}
}
