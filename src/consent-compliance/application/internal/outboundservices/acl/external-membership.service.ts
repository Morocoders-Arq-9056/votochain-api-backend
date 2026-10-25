import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { MEMBERSHIP_CONTEXT_FACADE } from "../../../../../membership/interfaces/acl/membership-context.facade.js";
import type { MembershipContextFacade } from "../../../../../membership/interfaces/acl/membership-context.facade.js";
import { RecordRevocationConfirmationCommand } from "../../../../domain/model/commands/record-revocation-confirmation.command.js";
import { DataSubjectRequestId } from "../../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { ErasureOwner } from "../../../../domain/model/valueobjects/erasure-owner.value-object.js";
import { ERASURE_COMMAND_SERVICE } from "../../../../domain/services/consent.services.js";
import type { ErasureCommandService } from "../../../../domain/services/consent.services.js";

/**
 * Partnership R12 outbound toward Membership. Erasure execution lives in the
 * owner (it terminates its own pairs); this adapter only carries the request
 * and records the owner's confirmation back, which may complete the flow.
 *
 * The owner facade resolves lazily via `ModuleRef` so the module graph stays
 * acyclic (owners consume CONSENT_CONTEXT_FACADE one-directionally).
 */
@Injectable()
export class ExternalMembershipService {
  private readonly logger = new Logger(ExternalMembershipService.name);

  constructor(
    private readonly modules: ModuleRef,
    @Inject(ERASURE_COMMAND_SERVICE) private readonly erasures: ErasureCommandService,
  ) {}

  async askOwnerToRevoke(personId: string, requestId: string): Promise<void> {
    const membership = this.modules.get<MembershipContextFacade>(MEMBERSHIP_CONTEXT_FACADE, { strict: false });
    const erased = await membership.eraseMembershipsByPerson(personId);
    this.logger.log(`membership erased ${erased} live pair(s) for ${personId} (request ${requestId})`);
    await this.erasures.recordRevocationConfirmation(
      new RecordRevocationConfirmationCommand(
        DataSubjectRequestId.of(requestId),
        ErasureOwner.of('membership'),
      ),
    );
  }
}
