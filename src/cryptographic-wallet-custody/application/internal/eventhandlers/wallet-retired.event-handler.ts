import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WalletRetiredEvent } from "../../../domain/model/events/wallet-retired.event.js";
import { ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";

/**
 * In-module reaction to retirement: confirms to Consent that this context
 * retired its own capability. Lives in THIS module — no other module
 * subscribes to Wallet events. Notice failure never reopens the retired
 * aggregate (already committed); it is logged for transport retry.
 */
@Injectable()
export class WalletRetiredEventHandler {
  private readonly logger = new Logger(WalletRetiredEventHandler.name);

  constructor(private readonly consent: ExternalConsentService) {}

  @OnEvent(WalletRetiredEvent.eventName, { async: true })
  async handleWalletRetired(event: WalletRetiredEvent): Promise<void> {
    try {
      await this.consent.notifyRetired(event.personId.value, event.walletId.value);
    } catch (err) {
      this.logger.error(`Consent retirement notice failed for ${event.walletId.value}: ${String(err)}`);
    }
  }
}
