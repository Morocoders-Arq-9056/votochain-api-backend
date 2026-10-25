import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RevocationConfirmedEvent } from "../../../domain/model/events/revocation-confirmed.event.js";
import { GetErasureStandingByPersonQuery } from "../../../domain/model/queries/get-erasure-standing-by-person.query.js";
import { ERASURE_QUERY_SERVICE } from "../../../domain/services/consent.services.js";
import type { ErasureQueryService } from "../../../domain/services/consent.services.js";

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
  async handleRevocationConfirmed(event: RevocationConfirmedEvent): Promise<void> {
    try {
      const standing = await this.erasureQueries.getErasureStandingByPerson(
        new GetErasureStandingByPersonQuery(event.personId));
      this.logger.log(`revocation by ${event.owner.value} for ${event.requestId.value}: ${standing?.standing ?? 'unknown'} (pending: ${standing?.pending.join(',') ?? '-'})`);
    } catch (e) {
      this.logger.error(`erasure standing reload failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
