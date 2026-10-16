import type { DomainEvent } from "../../../shared/domain/model/domain-event.js";
import { UserWallet } from "../model/aggregates/user-wallet.aggregate.js";
import { GetAdminshipHistoryByWalletQuery } from "../model/queries/get-adminship-history-by-wallet.query.js";
import { GetSigningCapabilityByPersonQuery } from "../model/queries/get-signing-capability-by-person.query.js";
import { GetUserWalletByIdQuery } from "../model/queries/get-user-wallet-by-id.query.js";

/**
 * Domain port for wallet reads (pull, no push). `getAdminshipHistoryByWallet`
 * reads persisted scrutiny (`wallet.events`), never in-memory reconstructions.
 */
export interface WalletQueryService {
  getSigningCapabilityByPerson(
    query: GetSigningCapabilityByPersonQuery,
  ): Promise<{ maySign: boolean; walletId: string | null; position: number | null }>;
  getAdminshipHistoryByWallet(query: GetAdminshipHistoryByWalletQuery): Promise<DomainEvent[]>;
  getUserWalletById(query: GetUserWalletByIdQuery): Promise<UserWallet | null>;
}
export const WALLET_QUERY_SERVICE = Symbol('WALLET_QUERY_SERVICE');
