import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AcceptDeliveryOrderCommand } from '../../../../../blockchain-relay-transaction-delivery/domain/model/commands/delivery.commands.js';
import { PayerRef } from '../../../../../blockchain-relay-transaction-delivery/domain/model/valueobjects/payer-ref.value-object.js';
import { DELIVERY_COMMAND_SERVICE } from '../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-command.service.js';
import type { DeliveryCommandService } from '../../../../../blockchain-relay-transaction-delivery/domain/services/delivery-command.service.js';
import { SignedContentRef } from '../../../../../shared/domain/model/valueobjects/signed-content-ref.value-object.js';

/**
 * Outbound ACL toward the blockchain-relay-transaction-delivery BC (R5).
 * Signed-only intake; only `DeliveryConfirmed` feeds the tally (H4).
 * With BullMQ, accept only enqueues; the worker delivers. No standing read here.
 */
@Injectable()
export class ExternalRelayService {
  private readonly logger = new Logger(ExternalRelayService.name);

  static readonly RELAYER_PAYER = 'relayer:polygon-amoy';

  constructor(
    @Optional() @Inject(DELIVERY_COMMAND_SERVICE) private readonly relayCommands?: DeliveryCommandService,
  ) {}

  /**
   * Accepts the signed envelope for delivery. The contentRef transports the
   * envelope wire (SignedVoteEnvelope.toWire). The wire non-empty satisfies
   * UnsignedContentRefusedError. Overload supports legacy 3-arg call.
   */
  async acceptSigned(voteId: string, envelopeWireOrSig: string, txPayload?: string): Promise<{ orderId: string }> {
    if (!this.relayCommands) {
      this.logger.warn(`relay unavailable, vote ${voteId} stays QUEUED`);
      throw new Error('RELAY_UNAVAILABLE');
    }
    let envelopeWire: string;
    let signedProof: string;
    if (txPayload !== undefined) {
      // Legacy call: (voteId, signature, txPayload)
      envelopeWire = txPayload;
      signedProof = envelopeWireOrSig;
    } else {
      envelopeWire = envelopeWireOrSig;
      signedProof = envelopeWire;
    }
    const contentRef = SignedContentRef.of(envelopeWire);
    const orderId = await this.relayCommands.acceptDeliveryOrder(
      new AcceptDeliveryOrderCommand(contentRef, PayerRef.of(ExternalRelayService.RELAYER_PAYER), signedProof),
    );
    this.logger.log(`vote ${voteId} accepted for delivery as ${orderId.value}`);
    return { orderId: orderId.value };
  }

  async answerStanding(): Promise<null> {
    return null;
  }
}
