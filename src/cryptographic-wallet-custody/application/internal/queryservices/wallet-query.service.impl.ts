import { Inject, Injectable } from "@nestjs/common";
import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { GetAdminshipHistoryByWalletQuery } from "../../../domain/model/queries/get-adminship-history-by-wallet.query.js";
import { GetSigningCapabilityByPersonQuery } from "../../../domain/model/queries/get-signing-capability-by-person.query.js";
import { GetUserWalletByIdQuery } from "../../../domain/model/queries/get-user-wallet-by-id.query.js";
import type { UserWallet } from "../../../domain/model/aggregates/user-wallet.aggregate.js";
import { WALLET_REPOSITORY } from "../../../domain/repositories/wallet.repository.js";
import type { WalletRepository } from "../../../domain/repositories/wallet.repository.js";
import type { WalletQueryService } from "../../../domain/services/wallet-query.service.js";

/**
 * Read-only query service. `getSigningCapabilityByPerson` delegates to the
 * aggregate's `answerCapability()`; history reads persisted scrutiny.
 */
@Injectable()
export class WalletQueryServiceImpl implements WalletQueryService {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository) {}

  async getSigningCapabilityByPerson(
    query: GetSigningCapabilityByPersonQuery,
  ): Promise<{ maySign: boolean; walletId: string | null; position: number | null }> {
    const live = await this.wallets.findLiveByPerson(query.personId);
    if (!live) return { maySign: false, walletId: null, position: null };
    const answer = live.answerCapability();
    return { maySign: answer.maySign, walletId: answer.walletId, position: answer.position };
  }

  async getAdminshipHistoryByWallet(query: GetAdminshipHistoryByWalletQuery): Promise<DomainEvent[]> {
    return this.wallets.findEventsByWallet(query.walletId);
  }

  async getUserWalletById(query: GetUserWalletByIdQuery): Promise<UserWallet | null> {
    return this.wallets.findById(query.walletId);
  }
}
