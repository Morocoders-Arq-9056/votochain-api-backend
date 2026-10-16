import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class WalletRetiredEvent implements DomainEvent {
  static readonly eventName = 'WalletRetired';
  readonly eventName = WalletRetiredEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly walletId: UserWalletId,
    public readonly personId: PersonId,
  ) {}
}
