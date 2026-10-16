import { UserWallet } from "../model/aggregates/user-wallet.aggregate.js";
import { DerivationPosition } from "../model/valueobjects/derivation-position.value-object.js";
import { PersonId } from "../model/valueobjects/person-id.value-object.js";
import { UserWalletId } from "../model/valueobjects/user-wallet-id.value-object.js";
import type { DomainEvent } from "../../../shared/domain/model/domain-event.js";

/**
 * Persistence port for the UserWallet aggregate root. Appends pulled events
 * to `wallet.events` in the same unit of work (scrutiny). Position
 * uniqueness is enforced by the UNIQUE constraint; `existsPosition()` is
 * the application guard and `nextPosition()` allocates the next candidate.
 */
export interface WalletRepository {
  findById(id: UserWalletId): Promise<UserWallet | null>;
  findLiveByPerson(personId: PersonId): Promise<UserWallet | null>;
  existsPosition(position: DerivationPosition): Promise<boolean>;
  nextPosition(): Promise<number>;
  save(wallet: UserWallet): Promise<void>;
  findEventsByWallet(id: UserWalletId): Promise<DomainEvent[]>;
}
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');
