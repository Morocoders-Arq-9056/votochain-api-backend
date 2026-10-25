import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ErasureConfirmedEvent } from "../../../domain/model/events/erasure-confirmed.event.js";
import { ExternalBiometricService } from "../outboundservices/acl/external-biometric.service.js";
import { ExternalMembershipService } from "../outboundservices/acl/external-membership.service.js";
import { ExternalNotificationsService } from "../outboundservices/acl/external-notifications.service.js";
import { ExternalWalletService } from "../outboundservices/acl/external-wallet.service.js";

/**
 * In-module fan-out of a confirmed erasure: asks every owning context to
 * revoke its own data (R12 Partnership). Each owner answers by POSTing back
 * `.../confirmations`. Failures only log — coordination state stays in the
 * aggregate and owners can poll `getErasureStanding`.
 */
@Injectable()
export class ErasureConfirmedEventHandler {
  private readonly logger = new Logger(ErasureConfirmedEventHandler.name);

  constructor(
    private readonly biometric: ExternalBiometricService,
    private readonly wallet: ExternalWalletService,
    private readonly membership: ExternalMembershipService,
    private readonly notifications: ExternalNotificationsService,
  ) {}

  @OnEvent(ErasureConfirmedEvent.eventName, { async: true })
  async handleErasureConfirmed(event: ErasureConfirmedEvent): Promise<void> {
    const personId = event.personId.value;
    const requestId = event.requestId.value;
    for (const ask of [
      () => this.biometric.askOwnerToRevoke(personId, requestId),
      () => this.wallet.askOwnerToRevoke(personId, requestId),
      () => this.membership.askOwnerToRevoke(personId, requestId),
      () => this.notifications.askOwnerToRevoke(personId, requestId),
    ]) {
      try { await ask(); }
      catch (e) { this.logger.error(`askOwnerToRevoke failed: ${e instanceof Error ? e.message : String(e)}`); }
    }
  }
}
