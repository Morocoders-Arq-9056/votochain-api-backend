import type { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { UserWallet } from "../../../domain/model/aggregates/user-wallet.aggregate.js";
import { AdminshipEntryResource } from "../resources/adminship-entry.resource.js";
import { CapabilityResource } from "../resources/capability.resource.js";
import { WalletResource } from "../resources/wallet.resource.js";

/** Renders response resources straight from re-read aggregates. */
export class WalletResourceFromEntityAssembler {
  static toResourceFromEntity(wallet: UserWallet): WalletResource {
    return new WalletResource(
      wallet.id.value,
      wallet.personId.value,
      wallet.position.value,
      wallet.standing,
      wallet.openFor?.value ?? null,
    );
  }

  static toCapabilityResource(answer: {
    maySign: boolean; walletId: string | null; position: number | null;
  }): CapabilityResource {
    return new CapabilityResource(answer.maySign, answer.walletId, answer.position);
  }

  static toHistoryResource(events: DomainEvent[]): AdminshipEntryResource[] {
    return events.map((e) => new AdminshipEntryResource(e.eventName, e.occurredAt));
  }
}
