import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { VERIFICATION_CONTEXT_FACADE, type VerificationContextFacade } from "../../../../../verification/interfaces/acl/verification-context.facade.js";

/**
 * Outbound ACL through which IAM asks Verification to open the initial
 * email-verification challenge after signup (onboarding EDA, R9 inverse).
 * Primitives-only at the boundary; IAM never imports Verification VOs.
 * Fire-and-forget from UserSignedUp: failures are logged, never thrown —
 * signup already committed and the front can re-request by-email.
 */
@Injectable()
export class ExternalVerificationService {
  private readonly logger = new Logger(ExternalVerificationService.name);

  constructor(
    @Optional() @Inject(VERIFICATION_CONTEXT_FACADE) private readonly verification?: VerificationContextFacade,
  ) {}

  async requestEmailVerification(personId: string): Promise<void> {
    if (!this.verification) {
      this.logger.log(`email-verification not wired for ${personId}`);
      return;
    }
    try {
      await this.verification.requestEmailVerification(personId);
    } catch (err) {
      this.logger.warn(`email-verification request failed for ${personId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
