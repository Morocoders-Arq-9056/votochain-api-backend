import { Injectable, Logger } from "@nestjs/common";

/**
 * Outbound ACL toward Consent (erasure coordination). Consent & Compliance
 * lands in Sprint-04; until then the retirement notice is logged. The
 * retirement itself never rolls back on notice failure.
 */
@Injectable()
export class ExternalConsentService {
  private readonly logger = new Logger(ExternalConsentService.name);

  /**
   * Confirms to Consent that this context retired its own capability.
   * @param personId Person whose capability was retired.
   * @param walletId Capability retired.
   */
  async notifyRetired(personId: string, walletId: string): Promise<void> {
    this.logger.log(`wallet retirement confirmed for ${personId} (${walletId})`);
  }
}
