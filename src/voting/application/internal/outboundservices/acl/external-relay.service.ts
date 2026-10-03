import { Injectable, Logger } from "@nestjs/common";

/**
 * Outbound ACL toward the blockchain-relay-transaction-delivery BC: delivery
 * of the signed vote to the chain relay (R5, Customer/Supplier + OHS).
 * Signed-only; only DeliveryConfirmed feeds the tally. No infrastructure of
 * this context may implement it: this consumer is the whole ACL until the
 * Relay facade exists.
 * TECH-DEBT: Sprint-02 fake — logs acceptance and no-ops. Confirmation
 * flows via the VoteCast handler calling markVoteConfirmed directly after
 * acceptSigned. Sprint-04 replaces this with real relay outcome events.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalRelayService {
  private readonly logger = new Logger(ExternalRelayService.name);

  async acceptSigned(voteId: string, _signature: string, _txPayload: string): Promise<void> {
    this.logger.log(`accepted signed vote ${voteId} (instant-confirm fake)`);
  }
}
