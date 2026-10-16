import { Injectable, Logger } from "@nestjs/common";

/** Partnership R12 outbound toward one owning context. Coordination only: this BC never touches another context's data. The owner deletes its own data, then POSTs back .../confirmations. */
@Injectable()
export class ExternalBiometricService {
  private readonly logger = new Logger(ExternalBiometricService.name);

  async askOwnerToRevoke(personId: string, requestId: string): Promise<void> { void personId; void requestId; }
}

