import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { ConsentRecord } from "../../../domain/model/aggregates/consent-record.aggregate.js";
import { GrantConsentCommand, RevokeConsentCommand } from "../../../domain/model/commands/consent.commands.js";
import { ConsentRecordId } from "../../../domain/model/valueobjects/consent-record-id.value-object.js";
import { ConsentAlreadyGrantedError } from "../../../domain/exceptions/consent-already-granted.error.js";
import { ConsentNotGrantedError } from "../../../domain/exceptions/consent-not-granted.error.js";
import { CONSENT_REPOSITORY } from "../../../domain/repositories/consent.repository.js";
import type { ConsentRepository } from "../../../domain/repositories/consent.repository.js";
import { ConsentCommandService } from "../../../domain/services/consent.services.js";

@Injectable()
export class ConsentCommandServiceImpl implements ConsentCommandService {
  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async grantConsent(cmd: GrantConsentCommand): Promise<ConsentRecordId> {
    const rec = await this.uow.run(async () => {
      const live = await this.consents.findLive(cmd.personId, cmd.scope);
      if (live) throw new ConsentAlreadyGrantedError('live GRANTED record already covers (person, scope)');
      const created = ConsentRecord.grant({ id: ConsentRecordId.generate(), personId: cmd.personId, scope: cmd.scope, policyVersion: cmd.policyVersion });
      await this.consents.save(created);
      return created;
    });
    for (const e of rec.pullDomainEvents()) this.events.emit(e.eventName, e);
    return rec.id;
  }

  async revokeConsent(cmd: RevokeConsentCommand): Promise<void> {
    const rec = await this.uow.run(async () => {
      const live = await this.consents.findLive(cmd.personId, cmd.scope);
      if (!live) throw new ConsentNotGrantedError('no live GRANTED record for (person, scope)');
      live.revoke();
      await this.consents.save(live);
      return live;
    });
    for (const e of rec.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
