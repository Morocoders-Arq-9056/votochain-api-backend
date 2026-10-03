import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ChallengeConfirmedEvent } from "../../../domain/model/events/challenge-confirmed.event.js";
import { Purpose } from "../../../domain/model/valueobjects/purpose.value-object.js";
import type { ExternalIamService } from "../outboundservices/acl/external-iam.service.js";

/**
 * In-module reaction to confirmed challenges (R9 reception point).
 * Skill rule: `@OnEvent` lives only in the emitting module; IAM is reached
 * through the ACL port, never by subscribing across modules. Purpose routing
 * stays here — which confirmations mean what to whom is Verification's
 * knowledge. Sprint-01 consumes email-verification only; login and
 * password-reset confirmations are logged until their consumers exist.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class ChallengeConfirmedEventHandler {
  private readonly logger = new Logger(ChallengeConfirmedEventHandler.name);

  /**
   * Wires the handler over the IAM ACL port.
   * @param iam Identity-existence and mark-verified gate.
   */
  constructor(private readonly iam: ExternalIamService) {}

  /**
   * Forwards email-verification confirmations to IAM (fact-only, never secret).
   * @param event The confirmed-challenge fact.
   */
  @OnEvent(ChallengeConfirmedEvent.eventName, { async: true })
  async handleChallengeConfirmed(event: ChallengeConfirmedEvent): Promise<void> {
    try {
      if (event.purpose !== Purpose.EMAIL_VERIFICATION) {
        this.logger.log(`confirmed ${event.purpose} challenge for ${event.personId.value}: no consumer in Sprint-01`);
        return;
      }
      await this.iam.markVerified(event.personId.value);
    } catch (err) {
      this.logger.error(`IAM R9 failed for ${event.personId.value}: ${String(err)}`);
    }
  }
}
