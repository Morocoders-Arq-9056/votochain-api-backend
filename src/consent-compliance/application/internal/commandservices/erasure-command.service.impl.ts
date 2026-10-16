import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { DataSubjectRequest } from "../../../domain/model/aggregates/data-subject-request.aggregate.js";
import { ConfirmErasureRequestCommand, RecordRevocationConfirmationCommand, SubmitErasureRequestCommand } from "../../../domain/model/commands/consent.commands.js";
import { DataSubjectRequestId } from "../../../domain/model/valueobjects/data-subject-request-id.value-object.js";
import { ERASURE_OWNERS } from "../../../domain/model/valueobjects/consent-standings.value-object.js";
import { RevocationConfirmations } from "../../../domain/model/valueobjects/revocation-confirmations.value-object.js";
import { ErasureAlreadyOpenError } from "../../../domain/exceptions/erasure-already-open.error.js";
import { RequestNotFoundError } from "../../../domain/exceptions/request-not-found.error.js";
import { ERASURE_REPOSITORY } from "../../../domain/repositories/erasure.repository.js";
import type { ErasureRepository } from "../../../domain/repositories/erasure.repository.js";
import { ErasureCommandService } from "../../../domain/services/consent.services.js";

@Injectable()
export class ErasureCommandServiceImpl implements ErasureCommandService {
  constructor(
    @Inject(ERASURE_REPOSITORY) private readonly requests: ErasureRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Opens one erasure flow for the person (at most one open — `uq_requests_open`).
   *
   * O5 disposition (in-flight votes at erasure time): ledger facts cannot
   * un-happen. Signatures/deliveries in-flight are abandoned with an audit
   * note; only owner-held data (biometric reference, wallet capability,
   * membership pair, notification intents) is revoked by each owner.
   */
  async submitErasureRequest(cmd: SubmitErasureRequestCommand): Promise<DataSubjectRequestId> {
    const req = await this.uow.run(async () => {
      const open = await this.requests.findOpenByPerson(cmd.personId);
      if (open) throw new ErasureAlreadyOpenError();
      const created = DataSubjectRequest.submit({
        id: DataSubjectRequestId.generate(),
        personId: cmd.personId,
        confirmations: new RevocationConfirmations([]),
      });
      await this.requests.save(created);
      return created;
    });
    for (const e of req.pullDomainEvents()) this.events.emit(e.eventName, e);
    return req.id;
  }

  async confirmErasureRequest(cmd: ConfirmErasureRequestCommand): Promise<void> {
    const req = await this.uow.run(async () => {
      const r = await this.requests.findById(cmd.requestId);
      if (!r) throw new RequestNotFoundError();
      r.confirm();
      r.coordinateRevocation([...ERASURE_OWNERS]);
      await this.requests.save(r);
      return r;
    });
    for (const e of req.pullDomainEvents()) this.events.emit(e.eventName, e);
  }

  async recordRevocationConfirmation(cmd: RecordRevocationConfirmationCommand): Promise<void> {
    const req = await this.uow.run(async () => {
      const r = await this.requests.findById(cmd.requestId);
      if (!r) throw new RequestNotFoundError();
      r.recordConfirmation(cmd.owner);
      try { r.complete(); } catch { /* owners remain: stays AWAITING_CONFIRMATIONS */ }
      await this.requests.save(r);
      return r;
    });
    for (const e of req.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
