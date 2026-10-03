import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { QueryFailedError } from "typeorm";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { NotificationDispatch } from "../../../domain/model/aggregates/notification-dispatch.aggregate.js";
import { ConfirmNotificationDeliveryCommand } from "../../../domain/model/commands/confirm-notification-delivery.command.js";
import { RecordNotificationDeliveryFailureCommand } from "../../../domain/model/commands/record-notification-delivery-failure.command.js";
import { RequestNotificationDeliveryCommand } from "../../../domain/model/commands/request-notification-delivery.command.js";
import { RetryNotificationDeliveryCommand } from "../../../domain/model/commands/retry-notification-delivery.command.js";
import { DispatchId } from "../../../domain/model/valueobjects/dispatch-id.value-object.js";
import { NOTIFICATION_DISPATCH_REPOSITORY } from "../../../domain/repositories/notification-dispatch.repository.js";
import type { NotificationDispatchRepository } from "../../../domain/repositories/notification-dispatch.repository.js";
import { NotificationDispatchCommandService } from "../../../domain/services/notification-dispatch-command.service.js";
import { DispatchNotFoundError } from "../../../domain/exceptions/dispatch-not-found.error.js";
import { type ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";
import { TEMPLATE_RESOLVER } from "../outboundservices/template/template-resolver.service.js";
import type { TemplateResolverService } from "../outboundservices/template/template-resolver.service.js";

/**
 * Application orchestration for the 4 NotificationDispatch write use cases.
 *
 * Holds no business rules: gates run BEFORE `uow.run()` (the transaction
 * groups DB statements only, never network I/O), the aggregate judges every
 * transition, and domain events publish strictly after the commit resolves.
 * The `findByKey()` check is a fast-path; the `UNIQUE(idempotency_key)`
 * constraint is the authority under race (23505 → persisted DUPLICATE refusal).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class NotificationDispatchCommandServiceImpl implements NotificationDispatchCommandService {
  /**
   * Wires the command service over persistence, transactions and gates.
   * Sending is owned by the in-module DeliveryRequestedEventHandler, so no
   * executor port is wired here.
   * @param dispatches Repository port for the NotificationDispatch aggregate.
   * @param unitOfWork Transaction boundary for writes.
   * @param templates Catalog port resolving template keys before the run.
   * @param consent May-contact gate judged before the run.
   * @param eventEmitter In-process bus for in-module handlers only.
   */
  constructor(
    @Inject(NOTIFICATION_DISPATCH_REPOSITORY) private readonly dispatches: NotificationDispatchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(TEMPLATE_RESOLVER) private readonly templates: TemplateResolverService,
    private readonly consent: ExternalConsentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Requests delivery of a notification intent (UC1 anchor).
   * Duplicate keys and consent refusals persist REFUSED history, then throw.
   * @inheritdoc
   */
  async requestNotificationDelivery(command: RequestNotificationDeliveryCommand): Promise<DispatchId> {
    const seen = await this.dispatches.findByKey(command.key); // fast-path outside the tx; UNIQUE is the authority
    const template = await this.templates.resolve(command.templateKey, command.templateValues); // catalog BEFORE run (throws TemplateUnknownError); tx groups DB only
    if (seen) {
      const { dispatch, error } = NotificationDispatch.refuseAndThrow({ id: DispatchId.generate(), key: command.key, address: command.address, template, reasonCode: 'DUPLICATE' });
      const refused = await this.unitOfWork.run(async () => {
        await this.dispatches.save(dispatch);
        return dispatch;
      });
      this.publishDomainEvents(refused);
      throw error;
    }
    const allowed = await this.consent.mayContactNow(command.address.value); // gate BEFORE run
    if (!allowed) {
      const { dispatch, error } = NotificationDispatch.refuseAndThrow({ id: DispatchId.generate(), key: command.key, address: command.address, template, reasonCode: 'CONTACT_NOT_ALLOWED' });
      const refused = await this.unitOfWork.run(async () => {
        await this.dispatches.save(dispatch);
        return dispatch;
      });
      this.publishDomainEvents(refused);
      throw error;
    }
    try {
      const created = await this.unitOfWork.run(async () => {
        const d = NotificationDispatch.requestDelivery({ id: DispatchId.generate(), key: command.key, address: command.address, template, reason: command.reason });
        await this.dispatches.save(d);
        return d;
      });
      this.publishDomainEvents(created);
      return created.id;
    } catch (err) {
      if (err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23505') {
        const { dispatch, error } = NotificationDispatch.refuseAndThrow({ id: DispatchId.generate(), key: command.key, address: command.address, template, reasonCode: 'DUPLICATE' });
        const refused = await this.unitOfWork.run(async () => {
          await this.dispatches.save(dispatch);
          return dispatch;
        });
        this.publishDomainEvents(refused);
        throw error;
      }
      throw err;
    }
  }

  /**
   * Confirms a REQUESTED dispatch as delivered (UC2 executor webhook).
   * @inheritdoc
   */
  async confirmNotificationDelivery(command: ConfirmNotificationDeliveryCommand): Promise<void> {
    const dispatch = await this.unitOfWork.run(async () => {
      const d = await this.require(command.dispatchId);
      d.confirmDelivered();
      await this.dispatches.save(d);
      return d;
    });
    this.publishDomainEvents(dispatch);
  }

  /**
   * Records an executor-observed delivery failure (UC3 webhook).
   * @inheritdoc
   */
  async recordNotificationDeliveryFailure(command: RecordNotificationDeliveryFailureCommand): Promise<void> {
    const dispatch = await this.unitOfWork.run(async () => {
      const d = await this.require(command.dispatchId);
      d.recordDeliveryFailure(command.reason);
      await this.dispatches.save(d);
      return d;
    });
    this.publishDomainEvents(dispatch);
  }

  /**
   * Retries a FAILED dispatch, re-entering REQUESTED on the same dispatch (UC4).
   * @inheritdoc
   */
  async retryNotificationDelivery(command: RetryNotificationDeliveryCommand): Promise<void> {
    const dispatch = await this.unitOfWork.run(async () => {
      const d = await this.require(command.dispatchId);
      d.requestRetry();
      await this.dispatches.save(d);
      return d;
    });
    this.publishDomainEvents(dispatch);
  }

  /**
   * Loads the aggregate or raises for unknown ids.
   * Controllers pre-check via the query side and answer 404; this is the safety net.
   * @param id Dispatch identity id.
   */
  private async require(id: DispatchId): Promise<NotificationDispatch> {
    const dispatch = await this.dispatches.findById(id);
    if (!dispatch) throw new DispatchNotFoundError(`dispatch not found: ${id.value}`);
    return dispatch;
  }

  /**
   * Drains buffered domain events after commit; never called inside run().
   * @param dispatch Aggregate whose events are published to in-module handlers.
   */
  private publishDomainEvents(dispatch: NotificationDispatch): void {
    for (const event of dispatch.pullDomainEvents()) {
      this.eventEmitter.emit(event.eventName, event);
    }
  }
}
