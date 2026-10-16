import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { DerivationPosition } from "../valueobjects/derivation-position.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";
import { UserWalletId } from "../valueobjects/user-wallet-id.value-object.js";

export class WalletProvisionedEvent implements DomainEvent {
  static readonly eventName = 'WalletProvisioned';
  readonly eventName = WalletProvisionedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly walletId: UserWalletId,
    public readonly personId: PersonId,
    public readonly position: DerivationPosition,
  ) {}
}
