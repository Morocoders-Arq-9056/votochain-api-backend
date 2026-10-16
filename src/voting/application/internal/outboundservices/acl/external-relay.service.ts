import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { AcceptDeliveryOrderCommand, DeliverOrderCommand } from "../../../../../blockchain-relay-transaction-delivery/domain/model/commands/delivery.commands.js";
import { GetDeliveryOrderStandingByIdQuery } from "../../../../../blockchain-relay-transaction-delivery/domain/model/queries/delivery.queries.js";
import { DeliveryOrderId } from "../../../../../blockchain-relay-transaction-delivery/domain/model/valueobjects/delivery-order-id.value-object.js";
import { PayerRef } from "../../../../../blockchain-relay-transaction-delivery/domain/model/valueobjects/payer-ref.value-object.js";
import { DELIVERY_COMMAND_SERVICE } from "../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-command.service.js";
import type { DeliveryCommandService } from "../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-command.service.js";
import { DELIVERY_QUERY_SERVICE } from "../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-query.service.js";
import type { DeliveryQueryService } from "../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-query.service.js";
import { SignedContentRef } from "../../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js";

/**
 * Outbound ACL toward the blockchain-relay-transaction-delivery BC (R5,
 * Customer/Supplier + OHS). Signed-only intake; only `DeliveryConfirmed`
 * feeds the tally (H4 intent-vs-fact).
 *
 * Sprint-04 real delivery: `acceptSigned` accepts the signed vote as a
 * `DeliveryOrder` (idempotent by open contentRef), drives `deliverOrder()`
 * (order → send → ledger.observe → confirm | fail → retry | abandon) and
 * answers the resulting standing. The queued worker re-execution no-ops
 * idempotently by standing. Primitives at the boundary: strings in, plain
 * outcome out — this class is the translation point into Relay VOs.
 */
@Injectable()
export class ExternalRelayService {
  private readonly logger = new Logger(ExternalRelayService.name);

  /** Payer capability funding sending (opaque; never a signing capability — R6). */
  static readonly RELAYER_PAYER = 'relayer:polygon-amoy';

  constructor(
    @Optional() @Inject(DELIVERY_COMMAND_SERVICE) private readonly relayCommands?: DeliveryCommandService,
    @Optional() @Inject(DELIVERY_QUERY_SERVICE) private readonly relayQueries?: DeliveryQueryService,
  ) {}

  async acceptSigned(voteId: string, signature: string, txPayload: string): Promise<{ orderId: string; confirmed: boolean; reason: string | null }> {
    if (!this.relayCommands || !this.relayQueries) {
      this.logger.warn(`relay unavailable, vote ${voteId} stays SENT (no InstantConfirm)`);
      return { orderId: '', confirmed: false, reason: 'RELAY_UNAVAILABLE' };
    }
    const contentRef = SignedContentRef.of(txPayload);
    const orderId = await this.relayCommands.acceptDeliveryOrder(
      new AcceptDeliveryOrderCommand(contentRef, PayerRef.of(ExternalRelayService.RELAYER_PAYER), signature));
    await this.relayCommands.deliverOrder(new DeliverOrderCommand(orderId));
    const standing = await this.relayQueries.getDeliveryOrderStandingById(
      new GetDeliveryOrderStandingByIdQuery(orderId));
    this.logger.log(`vote ${voteId} relay standing: ${standing.standing}`);
    return { orderId: orderId.value, confirmed: standing.standing === 'CONFIRMED', reason: standing.reason };
  }

  async answerStanding(orderId: string): Promise<{ standing: string; reason: string | null } | null> {
    if (!this.relayQueries || !orderId) return null;
    try {
      return await this.relayQueries.getDeliveryOrderStandingById(
        new GetDeliveryOrderStandingByIdQuery(DeliveryOrderId.of(orderId)));
    } catch {
      return null;
    }
  }
}
