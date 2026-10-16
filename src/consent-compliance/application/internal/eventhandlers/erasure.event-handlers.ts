import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ErasureConfirmedEvent, RevocationConfirmedEvent } from "../../../domain/model/events/consent.events.js";
import { GetErasureStandingByPersonQuery } from "../../../domain/model/queries/consent.queries.js";
import { ERASURE_QUERY_SERVICE } from "../../../domain/services/consent.services.js";
import { Inject } from "@nestjs/common";
import type { ErasureQueryService } from "../../../domain/services/consent.services.js";
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
  async handle(event: ErasureConfirmedEvent): Promise<void> {
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

/**
 * Observability of revocation progress: reloads the standing after every
 * owner confirmation. Closure is decided by the command service
 * (`try complete()`), never here.
 */
@Injectable()
export class RevocationConfirmedEventHandler {
  private readonly logger = new Logger(RevocationConfirmedEventHandler.name);

  constructor(@Inject(ERASURE_QUERY_SERVICE) private readonly erasureQueries: ErasureQueryService) {}

  @OnEvent(RevocationConfirmedEvent.eventName, { async: true })
  async handle(event: RevocationConfirmedEvent): Promise<void> {
    try {
      const standing = await this.erasureQueries.getErasureStandingByPerson(
        new GetErasureStandingByPersonQuery(event.personId));
      this.logger.log(`revocation by ${event.owner} for ${event.requestId.value}: ${standing?.standing ?? 'unknown'} (pending: ${standing?.pending.join(',') ?? '-'})`);
    } catch (e) {
      this.logger.error(`erasure standing reload failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
