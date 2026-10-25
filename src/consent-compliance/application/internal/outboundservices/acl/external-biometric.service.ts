import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { BIOMETRIC_CONTEXT_FACADE } from "../../../../../biometric-identity-verification/interfaces/acl/biometric-context.facade.js";
import type { BiometricContextFacade } from "../../../../../biometric-identity-verification/interfaces/acl/biometric-context.facade.js";
import { RecordRevocationConfirmationCommand } from "../../../../domain/model/commands/record-revocation-confirmation.command.js";
import { DataSubjectRequestId } from "../../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { ErasureOwner } from "../../../../domain/model/valueobjects/erasure-owner.value-object.js";
import { ERASURE_COMMAND_SERVICE } from "../../../../domain/services/consent.services.js";
import type { ErasureCommandService } from "../../../../domain/services/consent.services.js";

/**
 * Partnership R12 outbound toward Biometric Identity Verification. Erasure
 * execution lives in the owner (it revokes its own reference); this adapter
 * only carries the request and records the owner's confirmation back, which
 * may complete the flow.
 *
 * The owner facade resolves lazily via `ModuleRef` so the module graph stays
 * acyclic (owners consume CONSENT_CONTEXT_FACADE one-directionally).
 */
@Injectable()
export class ExternalBiometricService {
  private readonly logger = new Logger(ExternalBiometricService.name);

  constructor(
    private readonly modules: ModuleRef,
    @Inject(ERASURE_COMMAND_SERVICE) private readonly erasures: ErasureCommandService,
  ) {}

  async askOwnerToRevoke(personId: string, requestId: string): Promise<void> {
    const biometric = this.modules.get<BiometricContextFacade>(BIOMETRIC_CONTEXT_FACADE, { strict: false });
    const erased = await biometric.eraseBiometricReferenceByPerson(personId);
    this.logger.log(`biometric revoked ${erased} reference(s) for ${personId} (request ${requestId})`);
    await this.erasures.recordRevocationConfirmation(
      new RecordRevocationConfirmationCommand(
        DataSubjectRequestId.of(requestId),
        ErasureOwner.of('biometric'),
      ),
    );
  }
}
