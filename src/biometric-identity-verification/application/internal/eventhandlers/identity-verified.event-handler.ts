import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { BiometricProfileRevokedEvent } from "../../../domain/model/events/biometric-profile-revoked.event.js";
import { IdentityVerificationFailedEvent } from "../../../domain/model/events/identity-verification-failed.event.js";
import { IdentityVerifiedEvent } from "../../../domain/model/events/identity-verified.event.js";
import { ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";

/**
 * In-module reaction to identity facts. Lives in THIS module — no other
 * module subscribes to Biometric events (single bus, no isolation). R3 is
 * pull-based (Voting consumes the facade answer), so this handler is the
 * observability seam plus the revocation confirmation toward Consent.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class IdentityVerifiedEventHandler {
  private readonly logger = new Logger(IdentityVerifiedEventHandler.name);

  constructor(private readonly consent: ExternalConsentService) {}

  @OnEvent(IdentityVerifiedEvent.eventName, { async: true })
  async handleIdentityVerified(event: IdentityVerifiedEvent): Promise<void> {
    this.logger.log(`identity verified ${event.personId.value} via ${event.attemptId.value}`);
  }

  @OnEvent(IdentityVerificationFailedEvent.eventName, { async: true })
  handleIdentityVerificationFailed(event: IdentityVerificationFailedEvent): void {
    this.logger.warn(`identity verification failed ${event.personId.value}: ${event.reason}`);
  }

  @OnEvent(BiometricProfileRevokedEvent.eventName, { async: true })
  async handleBiometricProfileRevoked(event: BiometricProfileRevokedEvent): Promise<void> {
    try {
      await this.consent.notifyRevoked(event.personId.value);
    } catch (err) {
      this.logger.error(`Consent revocation notice failed for ${event.personId.value}: ${String(err)}`);
    }
  }
}
