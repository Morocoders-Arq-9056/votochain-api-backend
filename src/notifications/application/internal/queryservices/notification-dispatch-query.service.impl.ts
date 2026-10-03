import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_DISPATCH_REPOSITORY } from "../../../domain/repositories/notification-dispatch.repository.js";
import type { NotificationDispatchRepository } from "../../../domain/repositories/notification-dispatch.repository.js";
import { NotificationDispatchQueryService } from "../../../domain/services/notification-dispatch-query.service.js";
import { GetDeliveryHistoryByDispatchQuery } from "../../../domain/model/queries/get-delivery-history-by-dispatch.query.js";
import { GetDeliveryStandingByDispatchQuery } from "../../../domain/model/queries/get-delivery-standing-by-dispatch.query.js";
import { GetDeliveryStandingByKeyQuery } from "../../../domain/model/queries/get-delivery-standing-by-key.query.js";
import { DeliveryHistoryAnswer } from "../../../domain/model/valueobjects/delivery-history-answer.value-object.js";
import { DeliveryStandingAnswer } from "../../../domain/model/valueobjects/delivery-standing-answer.value-object.js";

/**
 * Read-only query service for delivery standing and history.
 * No unit of work, no mutations, no events: pure orchestration over the
 * repository port plus the aggregate's answering operations.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class NotificationDispatchQueryServiceImpl implements NotificationDispatchQueryService {
  /**
   * Wires the query service over the repository port.
   * @param dispatches Repository port for the NotificationDispatch aggregate.
   */
  constructor(
    @Inject(NOTIFICATION_DISPATCH_REPOSITORY) private readonly dispatches: NotificationDispatchRepository,
  ) {}

  /**
   * Answers the delivery standing of one dispatch by id, or null when unknown.
   * @inheritdoc
   */
  async getDeliveryStandingByDispatch(query: GetDeliveryStandingByDispatchQuery): Promise<DeliveryStandingAnswer | null> {
    const dispatch = await this.dispatches.findById(query.dispatchId);
    if (!dispatch) return null;
    const answer = dispatch.answerDeliveryStanding();
    return new DeliveryStandingAnswer(dispatch.id, answer.standing, answer.attempts, answer.refusal);
  }

  /**
   * Answers the delivery standing of one intent by idempotency key, or null when unknown.
   * @inheritdoc
   */
  async getDeliveryStandingByKey(query: GetDeliveryStandingByKeyQuery): Promise<DeliveryStandingAnswer | null> {
    const dispatch = await this.dispatches.findByKey(query.key);
    if (!dispatch) return null;
    const answer = dispatch.answerDeliveryStanding();
    return new DeliveryStandingAnswer(dispatch.id, answer.standing, answer.attempts, answer.refusal);
  }

  /**
   * Reads the full attempt history of one dispatch. Unknown dispatches
   * answer an empty history.
   * @inheritdoc
   */
  async getDeliveryHistoryByDispatch(query: GetDeliveryHistoryByDispatchQuery): Promise<DeliveryHistoryAnswer> {
    const dispatch = await this.dispatches.findById(query.dispatchId);
    if (!dispatch) return new DeliveryHistoryAnswer(query.dispatchId, []);
    return new DeliveryHistoryAnswer(dispatch.id, dispatch.history);
  }
}
