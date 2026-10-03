import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_DISPATCH_COMMAND_SERVICE } from "../../domain/services/notification-dispatch-command.service.js";
import type { NotificationDispatchCommandService } from "../../domain/services/notification-dispatch-command.service.js";
import { NOTIFICATION_DISPATCH_QUERY_SERVICE } from "../../domain/services/notification-dispatch-query.service.js";
import type { NotificationDispatchQueryService } from "../../domain/services/notification-dispatch-query.service.js";
import { RequestNotificationDeliveryCommand } from "../../domain/model/commands/request-notification-delivery.command.js";
import { DeliveryAddress } from "../../domain/model/valueobjects/delivery-address.value-object.js";
import { DispatchNotFoundError } from "../../domain/exceptions/dispatch-not-found.error.js";
import { DispatchId } from "../../domain/model/valueobjects/dispatch-id.value-object.js";
import { IdempotencyKey } from "../../domain/model/valueobjects/idempotency-key.value-object.js";
import { GetDeliveryHistoryByDispatchQuery } from "../../domain/model/queries/get-delivery-history-by-dispatch.query.js";
import { GetDeliveryStandingByKeyQuery } from "../../domain/model/queries/get-delivery-standing-by-key.query.js";
import type { NotificationContextFacade } from "../../interfaces/acl/notification-context.facade.js";

/**
 * Application implementation of the published {@link NotificationContextFacade}.
 * Translates primitive boundary strings into domain VOs, delegates to the
 * command/query services, and translates back to primitives.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class NotificationContextFacadeImpl implements NotificationContextFacade {
  /**
   * Wires the facade over the write and read application services.
   * @param commands Write-side application service (intent requests).
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(NOTIFICATION_DISPATCH_COMMAND_SERVICE) private readonly commands: NotificationDispatchCommandService,
    @Inject(NOTIFICATION_DISPATCH_QUERY_SERVICE) private readonly queries: NotificationDispatchQueryService,
  ) {}

  /**
   * Requests delivery of a notification intent (UC1 anchor).
   * @inheritdoc
   */
  async requestDelivery(key: string, address: string, templateKey: string, templateValues: Record<string, string>, reason: string): Promise<string> {
    const id = await this.commands.requestNotificationDelivery(
      new RequestNotificationDeliveryCommand(
        IdempotencyKey.of(key),
        DeliveryAddress.of(address),
        templateKey,
        templateValues ?? {},
        reason,
      ),
    );
    return id.value;
  }

  /**
   * Answers the standing of one intent by idempotency key.
   * @param key Requester-supplied idempotency key string.
   */
  async getStandingByKey(key: string): Promise<{ standing: string; attempts: number }> {
    let parsed: IdempotencyKey;
    try {
      parsed = IdempotencyKey.of(key);
    } catch {
      throw new DispatchNotFoundError(`dispatch not found for key: ${key}`);
    }
    const answer = await this.queries.getDeliveryStandingByKey(new GetDeliveryStandingByKeyQuery(parsed));
    if (!answer) throw new DispatchNotFoundError(`dispatch not found for key: ${key}`);
    return { standing: answer.standing, attempts: answer.attempts };
  }

  /**
   * Reads the attempt history of one dispatch. Unknown dispatches answer
   * an empty attempt list.
   * @param dispatchId Dispatch id (`dsp-` prefixed string).
   */
  async getHistory(dispatchId: string): Promise<{ attempts: { at: string; outcome: string }[] }> {
    const answer = await this.queries.getDeliveryHistoryByDispatch(new GetDeliveryHistoryByDispatchQuery(DispatchId.of(dispatchId)));
    return { attempts: answer.attempts.map((a) => ({ at: a.at.toISOString(), outcome: a.outcome })) };
  }
}
