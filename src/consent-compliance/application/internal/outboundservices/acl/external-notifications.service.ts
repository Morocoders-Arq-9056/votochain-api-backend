import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { NOTIFICATION_CONTEXT_FACADE } from "../../../../../notifications/interfaces/acl/notification-context.facade.js";
import type { NotificationContextFacade } from "../../../../../notifications/interfaces/acl/notification-context.facade.js";
import { RecordRevocationConfirmationCommand } from "../../../../domain/model/commands/record-revocation-confirmation.command.js";
import { DataSubjectRequestId } from "../../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { ErasureOwner } from "../../../../domain/model/valueobjects/erasure-owner.value-object.js";
import { ERASURE_COMMAND_SERVICE } from "../../../../domain/services/consent.services.js";
import type { ErasureCommandService } from "../../../../domain/services/consent.services.js";

/**
 * Partnership R12 outbound toward Notifications. Erasure execution lives in
 * the owner (it redacts the person reference from render values - the only
 * person-linked data a dispatch holds; standing/history stay as delivery
 * audit). This adapter carries the request and records the confirmation back,
 * which may complete the flow.
 *
 * The owner facade resolves lazily via `ModuleRef` so the module graph stays
 * acyclic (Notifications consumes CONSENT_CONTEXT_FACADE one-directionally).
 *
 * Residual: the destination `address` column cannot be matched to a person
 * without IAM's address?person mapping (out of scope); contact suppression
 * from that moment on is already enforced by the revoked consent gate.
 */
@Injectable()
export class ExternalNotificationsService {
  private readonly logger = new Logger(ExternalNotificationsService.name);

  constructor(
    private readonly modules: ModuleRef,
    @Inject(ERASURE_COMMAND_SERVICE) private readonly erasures: ErasureCommandService,
  ) {}

  async askOwnerToRevoke(personId: string, requestId: string): Promise<void> {
    const notifications = this.modules.get<NotificationContextFacade>(NOTIFICATION_CONTEXT_FACADE, { strict: false });
    const scrubbed = await notifications.scrubDispatchesByPerson(personId);
    this.logger.log(`notifications scrubbed ${scrubbed} dispatch(es) for ${personId} (request ${requestId})`);
    await this.erasures.recordRevocationConfirmation(
      new RecordRevocationConfirmationCommand(
        DataSubjectRequestId.of(requestId),
        ErasureOwner.of('notifications'),
      ),
    );
  }
}
