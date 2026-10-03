import { ConfirmNotificationDeliveryCommand } from "../model/commands/confirm-notification-delivery.command.js";
import { RecordNotificationDeliveryFailureCommand } from "../model/commands/record-notification-delivery-failure.command.js";
import { RequestNotificationDeliveryCommand } from "../model/commands/request-notification-delivery.command.js";
import { RetryNotificationDeliveryCommand } from "../model/commands/retry-notification-delivery.command.js";
import { DispatchId } from "../model/valueobjects/dispatch-id.value-object.js";

/**
 * Domain port for NotificationDispatch write use cases (CQRS command side).
 *
 * Naming follows skill ddd-guideliness v1.0.11: one method per command,
 * `methodName = lowerCamel(ClassName without Command suffix)`, receiving
 * the command object. Implementations live in application and hold no
 * business rules; every invariant is enforced by the `NotificationDispatch`
 * aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface NotificationDispatchCommandService {
  /**
   * Requests delivery of a notification intent (UC1 anchor).
   * @param command Carries key, address, template key/values and reason.
   * @returns A promise that resolves to the newly created DispatchId.
   */
  requestNotificationDelivery(command: RequestNotificationDeliveryCommand): Promise<DispatchId>;

  /**
   * Confirms a REQUESTED dispatch as delivered (UC2 executor webhook).
   * @param command Carries the dispatch id.
   */
  confirmNotificationDelivery(command: ConfirmNotificationDeliveryCommand): Promise<void>;

  /**
   * Records an executor-observed delivery failure (UC3 webhook).
   * @param command Carries the dispatch id and the failure cause.
   */
  recordNotificationDeliveryFailure(command: RecordNotificationDeliveryFailureCommand): Promise<void>;

  /**
   * Retries a FAILED dispatch, re-entering REQUESTED (UC4).
   * @param command Carries the dispatch id.
   */
  retryNotificationDelivery(command: RetryNotificationDeliveryCommand): Promise<void>;
}
/**
 * Injection token for the {@link NotificationDispatchCommandService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const NOTIFICATION_DISPATCH_COMMAND_SERVICE = Symbol('NOTIFICATION_DISPATCH_COMMAND_SERVICE');
