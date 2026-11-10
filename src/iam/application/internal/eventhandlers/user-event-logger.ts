import { Inject, Injectable, Optional } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AccessRestoredEvent } from "../../../domain/model/events/access-restored.event.js";
import { AccessSuspendedEvent } from "../../../domain/model/events/access-suspended.event.js";
import { EmailChangedEvent } from "../../../domain/model/events/email-changed.event.js";
import { SecretChangedEvent } from "../../../domain/model/events/secret-changed.event.js";
import { UserSignedInEvent } from "../../../domain/model/events/user-signed-in.event.js";
import { UserSignedOutEvent } from "../../../domain/model/events/user-signed-out.event.js";
import { UserSignedUpEvent } from "../../../domain/model/events/user-signed-up.event.js";
import { ExternalNotificationsService } from "../outboundservices/acl/external-notifications.service.js";
import { SESSION_ARTIFACT_SERVICE } from "../outboundservices/session/session-artifact.service.js";
import type { SessionArtifactService } from "../outboundservices/session/session-artifact.service.js";
import { ExternalVerificationService } from "../outboundservices/acl/external-verification.service.js";

/**
 * In-module fan-out for IAM domain events (Observer, never cross-BC).
 * Skill rule: `@OnEvent` lives only in the emitting module; other contexts
 * are reached through ACL ports, never by subscribing to these events.
 * Publish happens strictly after `UNIT_OF_WORK.run()` resolves. Handlers run
 * `{ async: true }` fire-and-forget with per-call error swallowing: slow
 * notice/artifact ports must never block the request.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class UserEventLogger {
  /**
   * Wires optional outbound side-effects; works with logger-only when absent.
   * @param notifications Person-notice port (LogOnly fake in Sprint-01).
   * @param sessions Session-artifact port (executor instruction).
   */
  constructor(
    @Optional() private readonly notifications?: ExternalNotificationsService,
    @Optional() @Inject(SESSION_ARTIFACT_SERVICE) private readonly sessions?: SessionArtifactService,
    @Optional() private readonly verification?: ExternalVerificationService,
  ) {}

  /**
   * Reacts to sign-up by sending the welcome notice and opening the initial
   * email-verification challenge (onboarding EDA). Both are fire-and-forget:
   * failures never roll back the committed signup; the front can re-request
   * the challenge by-email.
   */
  @OnEvent(UserSignedUpEvent.eventName, { async: true })
  async onSignedUp(event: UserSignedUpEvent): Promise<void> {
    await this.notifications?.welcome(event.contact.email).catch(() => undefined);
    await this.verification?.requestEmailVerification(event.personId.value).catch(() => undefined);
  }

  /**
   * Reacts to sign-in by instructing the executor to issue the artifact.
   */
  @OnEvent(UserSignedInEvent.eventName, { async: true })
  async onSignedIn(event: UserSignedInEvent): Promise<void> {
    await this.sessions?.issue(event.userId.value).catch(() => undefined);
  }

  /**
   * Reacts to sign-out by instructing the executor to end the artifact.
   */
  @OnEvent(UserSignedOutEvent.eventName, { async: true })
  async onSignedOut(event: UserSignedOutEvent): Promise<void> {
    await this.sessions?.end(event.userId.value, event.reason).catch(() => undefined);
  }

  /**
   * Reacts to secret change with a security notice.
   */
  @OnEvent(SecretChangedEvent.eventName, { async: true })
  async onSecretChanged(event: SecretChangedEvent): Promise<void> {
    const user = event.userId.value;
    await this.notifications?.security(user, "secret-changed").catch(() => undefined);
  }

  /**
   * Reacts to email change with a security notice.
   */
  @OnEvent(EmailChangedEvent.eventName, { async: true })
  async onEmailChanged(event: EmailChangedEvent): Promise<void> {
    await this.notifications?.security(event.newEmail, "email-changed").catch(() => undefined);
  }

  /**
   * Reacts to suspension with a security notice.
   */
  @OnEvent(AccessSuspendedEvent.eventName, { async: true })
  async onSuspended(event: AccessSuspendedEvent): Promise<void> {
    await this.notifications?.security(event.userId.value, "suspended").catch(() => undefined);
  }

  /**
   * Reacts to restoration with a security notice.
   */
  @OnEvent(AccessRestoredEvent.eventName, { async: true })
  async onRestored(event: AccessRestoredEvent): Promise<void> {
    await this.notifications?.security(event.userId.value, "restored").catch(() => undefined);
  }
}
